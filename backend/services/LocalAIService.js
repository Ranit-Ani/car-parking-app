const path = require('path');
const fs = require('fs');
const { runTool } = require('./aiTools');
const ParkingLocation = require('../models/ParkingLocation');

// The ai/ directory sits at the project root, alongside backend/ and frontend/.
const AI_ROOT = path.resolve(__dirname, '..', '..', 'ai');
const INTENTS_CONFIG_PATH = path.join(AI_ROOT, 'config', 'intents.json');
const AI_API_URL = process.env.AI_API_URL || 'http://127.0.0.1:5001';

let intentsConfig = null;
function loadIntentsConfig() {
  if (!intentsConfig) {
    const raw = fs.readFileSync(INTENTS_CONFIG_PATH, 'utf-8');
    intentsConfig = JSON.parse(raw);
  }
  return intentsConfig;
}

function intentByTag(tag) {
  const cfg = loadIntentsConfig();
  return cfg.intents.find((i) => i.tag === tag);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Multi-location: resolve a location name mentioned in the message ──────
// The intent classifier only predicts a tag (greeting / check_availability /
// etc) — it has no idea about entities like "Block C" or "Downtown Lot",
// because those are per-deployment data, not fixed vocabulary. So for the
// handful of intents where a location matters (availability, occupancy,
// revenue) we do a lightweight, cheap substring match against the active
// ParkingLocation names ourselves, after classification.
//
// Locations are cached for a short window since this runs on every chat
// message and the location list changes rarely.
let locationCache = { at: 0, list: [] };
const LOCATION_CACHE_MS = 60 * 1000;

async function getActiveLocations() {
  if (Date.now() - locationCache.at < LOCATION_CACHE_MS) return locationCache.list;
  const list = await ParkingLocation.find({ isActive: true }).select('name').lean();
  locationCache = { at: Date.now(), list };
  return list;
}

async function resolveLocationFromText(message) {
  const locations = await getActiveLocations();
  if (!locations.length) return null;
  const lower = message.toLowerCase();
  // Prefer the longest matching name so e.g. "Block C Annex" doesn't get
  // shadowed by a shorter "Block C" that also happens to be a substring.
  let best = null;
  for (const loc of locations) {
    const name = (loc.name || '').trim();
    if (name.length >= 3 && lower.includes(name.toLowerCase())) {
      if (!best || name.length > best.name.length) best = { id: loc._id, name };
    }
  }
  return best;
}

const LOCATION_AWARE_TOOLS = new Set(['get_slot_availability', 'get_occupancy_insights', 'get_revenue_report']);

// ─── Call the self-hosted classifier (ai/api/app.py) ───────────────────────
async function classify(message) {
  let res;
  try {
    res = await fetch(`${AI_API_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    const e = new Error(
      'The AI model service is not reachable. Make sure the Python API is running (python ai/api/app.py).'
    );
    e.statusCode = 503;
    throw e;
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    const e = new Error(body.message || 'The AI model failed to classify that message.');
    e.statusCode = res.status === 503 ? 503 : 500;
    throw e;
  }
  return body.data; // { intent, confidence, raw_intent, below_threshold, alternatives }
}

// ─── Formatters: turn raw tool data into a short chat reply ────────────────
const HOUR_LABEL = (h) => {
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${period}`;
};

function formatCheckAvailability(data) {
  if (!data.total) {
    return data.scopedToLocationName
      ? `There aren't any active slots configured at ${data.scopedToLocationName} right now.`
      : "There aren't any active slots configured right now.";
  }
  const status = data.byStatus || {};
  const scopeLabel = data.scopedToLocationName ? ` at ${data.scopedToLocationName}` : '';
  const lines = [
    `Right now${scopeLabel}: ${status.Available || 0} Available, ${status.Booked || 0} Booked, ${status.Occupied || 0} Occupied out of ${data.total} total slots.`,
  ];
  const rateEntries = Object.entries(data.ratesByType || {});
  if (rateEntries.length) {
    const rateText = rateEntries
      .map(([type, r]) => (r.min === r.max ? `${type}: ₹${r.min}/hr` : `${type}: ₹${r.min}-₹${r.max}/hr`))
      .join(', ');
    lines.push(`Rates — ${rateText}.`);
  }
  lines.push(data.billingNote);
  return lines.join('\n');
}

function formatOccupancyInsights(data) {
  const peak = (data.peakHours || []).map((h) => HOUR_LABEL(h.hour)).join(', ') || 'not enough data yet';
  const quiet = (data.quietHours || []).map((h) => HOUR_LABEL(h.hour)).join(', ') || 'not enough data yet';
  const days = (data.busiestDays || []).slice(0, 3).map((d) => d.day).join(', ') || 'not enough data yet';
  const scopeLabel = data.scopedToLocationName ? ` at ${data.scopedToLocationName}` : '';
  const lines = [
    `Peak hours${scopeLabel}: ${peak} (based on the last ${data.windowDays} days).`,
    `Quietest hours: ${quiet}.`,
    `Busiest days: ${days}.`,
  ];
  if (data.avgSessionMinutes != null) lines.push(`Average parking session: ${data.avgSessionMinutes} minutes.`);
  if (data.topSlots && data.topSlots.length) {
    const top = data.topSlots.slice(0, 3).map((s) => `${s.slotNumber || 'Unknown'} (${s.count})`).join(', ');
    lines.push(`Most-used slots: ${top}.`);
  }
  return lines.join('\n');
}

function formatMyBookings(data) {
  if (!data || !data.length) return "You don't have any bookings yet.";
  const lines = data.slice(0, 8).map((b) => {
    const locName = b.locationId && b.locationId.name;
    const slotLabel = b.slotId ? (b.slotId.slotNumber || '') : 'slot deleted';
    const place = locName || (b.slotId ? b.slotId.location : '') || '';
    const slot = `${slotLabel}${place ? ` (${place})` : ''}`.trim();
    const amount = b.totalAmount != null ? `₹${b.totalAmount}` : 'not billed yet';
    return `• ${b.status}: ${b.vehicleCategory || ''} ${b.vehicleNumber || ''} — ${slot} — ${amount}`;
  });
  return lines.join('\n');
}

function formatMyVehicles(data) {
  if (!data || !data.length) return "You don't have any saved vehicles yet — add one from Profile → My Vehicles.";
  return data
    .map((v) => `• ${v.category || 'Vehicle'}: ${v.registrationNumber || 'Registration Pending'}`)
    .join('\n');
}

function formatRevenueReport(data) {
  const total = data.totalRevenue || 0;
  const count = data.totalBookings || 0;
  const avg = data.avgAmount ? Math.round(data.avgAmount) : 0;
  const scopeLabel = data.scopedToLocationName ? ` at ${data.scopedToLocationName}` : '';
  const lines = [
    `Total revenue${scopeLabel}: ₹${total} from ${count} completed booking${count === 1 ? '' : 's'}. Average bill: ₹${avg}.`,
  ];
  if (data.byLocation && data.byLocation.length) {
    const top = data.byLocation.slice(0, 5).map((l) => `${l.name}: ₹${l.totalRevenue || 0}`).join(', ');
    lines.push(`By location — ${top}.`);
  }
  return lines.join('\n');
}

function formatUserRegistry(data) {
  const byRole = (data.byRole || []).map((r) => `${r._id}: ${r.count}`).join(', ') || 'no users found';
  const active = (data.activeCounts || []).map((a) => `${a._id ? 'active' : 'inactive'}: ${a.count}`).join(', ') || '—';
  const lines = [`Users by role — ${byRole}.`, `Account status — ${active}.`];
  if (data.staffByLocation && data.staffByLocation.length) {
    const byLoc = data.staffByLocation.map((s) => `${s.name}: ${s.count}`).join(', ');
    lines.push(`Staff by location — ${byLoc}.`);
  }
  return lines.join('\n');
}

function formatLocations(data) {
  if (!data || !data.length) return "There aren't any active parking locations set up yet.";
  const lines = data.slice(0, 10).map((l) => {
    const rate = l.minRate != null ? (l.minRate === l.maxRate ? `₹${l.minRate}/hr` : `₹${l.minRate}-₹${l.maxRate}/hr`) : 'rate n/a';
    return `• ${l.name}${l.address ? ` — ${l.address}` : ''} — ${l.availableSlots}/${l.totalSlots} available — ${rate}`;
  });
  return lines.join('\n');
}

const TOOL_FORMATTERS = {
  get_slot_availability: formatCheckAvailability,
  get_occupancy_insights: formatOccupancyInsights,
  get_my_bookings: formatMyBookings,
  get_my_vehicles: formatMyVehicles,
  get_revenue_report: formatRevenueReport,
  get_user_registry_summary: formatUserRegistry,
  get_locations: formatLocations,
};

// ─── Public: chat ────────────────────────────────────────────────────────
async function chat({ user, message }) {
  const prediction = await classify(message);
  let intentTag = prediction.intent;
  let def = intentByTag(intentTag);

  // Guard against a role trying to trigger an intent it isn't permitted to
  // use (e.g. a regular user's message happening to match "revenue_report").
  if (def && def.roles && !def.roles.includes(user.role)) {
    def = intentByTag('unknown');
    intentTag = 'unknown';
  }
  if (!def) {
    def = intentByTag('unknown');
    intentTag = 'unknown';
  }

  let reply;
  if (def.type === 'tool') {
    try {
      const args = {};
      // Staff are always locked to their own assigned location — this
      // overrides anything mentioned in the message (enforced again inside
      // aiTools.runTool, same as every other staff-facing endpoint).
      const ctx = { userId: user.id, locationId: user.role === 'staff' ? user.locationId || null : null };

      if (LOCATION_AWARE_TOOLS.has(def.tool) && user.role !== 'staff') {
        const matched = await resolveLocationFromText(message);
        if (matched) {
          args.locationId = matched.id;
          args.locationName = matched.name;
        }
      }

      const data = await runTool(def.tool, args, ctx);
      const formatter = TOOL_FORMATTERS[def.tool];
      reply = formatter ? formatter(data) : JSON.stringify(data);
    } catch (err) {
      reply = "I hit an error looking that up — please try again in a moment.";
    }
  } else {
    reply = pickRandom(def.responses);
  }

  return {
    reply,
    intent: intentTag,
    confidence: prediction.confidence,
  };
}

// ─── Public: scanPlate ───────────────────────────────────────────────────
// The custom model here is a text intent classifier, not a vision model, so
// it cannot read a plate from an image. Rather than failing the request,
// tell the frontend clearly so it can fall back to manual entry.
async function scanPlate() {
  return {
    plateNumber: null,
    confidence: 'low',
    vehicleCategoryGuess: null,
    note: "Automatic plate scanning isn't available with the self-hosted model — please type the registration number.",
  };
}

module.exports = { chat, scanPlate };
