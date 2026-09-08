const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');
const User = require('../models/User');

// Every role gets slot-availability + occupancy-insight tools, and can now
// also list parking locations ("get_locations"). "user" also gets their own
// bookings/vehicles; "admin" additionally gets revenue and user-registry
// tools. Staff behaves like a user for these purposes (no financial data,
// no personal bookings to look up).
//
// ─── Multi-location scoping ─────────────────────────────────────────────────
// `ctx.locationId` is set by LocalAIService whenever the caller is a staff
// member (always locked to their assigned ParkingLocation, same as every
// other staff-facing endpoint) — it OVERRIDES any location the caller
// mentioned in the chat message, so staff only ever see their own site.
// `args.locationId` carries a location resolved from the message text for
// user/admin callers (e.g. "is anything free at Block C?"), and is ignored
// when `ctx.locationId` is already set.
function effectiveLocationId(args, ctx) {
  return ctx.locationId || args.locationId || null;
}

// Resolves a human-readable location name for the scope currently in
// effect. `args.locationName` is already set when LocalAIService matched a
// location mentioned in the chat text; for staff (whose scope comes from
// their account, not the message) we look it up once here instead.
async function resolveLocationName(locId, args) {
  if (!locId) return null;
  if (args.locationName) return args.locationName;
  const loc = await ParkingLocation.findById(locId).select('name').lean();
  return loc ? loc.name : null;
}

async function runTool(name, args, ctx) {
  switch (name) {
    case 'get_locations': {
      const locations = await ParkingLocation.find({ isActive: true }).sort({ name: 1 });
      const locationIds = locations.map((l) => l._id);
      const slotStats = await ParkingSlot.aggregate([
        { $match: { locationId: { $in: locationIds }, isActive: true } },
        {
          $group: {
            _id: '$locationId',
            totalSlots: { $sum: 1 },
            availableSlots: { $sum: { $cond: [{ $eq: ['$status', 'Available'] }, 1, 0] } },
            minRate: { $min: '$hourlyRate' },
            maxRate: { $max: '$hourlyRate' },
          },
        },
      ]);
      const statsById = new Map(slotStats.map((s) => [s._id.toString(), s]));
      return locations.map((loc) => {
        const stats = statsById.get(loc._id.toString());
        return {
          locationId: loc._id,
          name: loc.name,
          address: loc.address,
          totalSlots: stats ? stats.totalSlots : 0,
          availableSlots: stats ? stats.availableSlots : 0,
          minRate: stats ? stats.minRate : null,
          maxRate: stats ? stats.maxRate : null,
        };
      });
    }
    case 'get_slot_availability': {
      const query = { isActive: true };
      if (args.slotType) query.slotType = args.slotType;
      const locId = effectiveLocationId(args, ctx);
      if (locId) {
        query.locationId = locId;
      } else if (args.location) {
        // Free-text fallback (legacy slots without a locationId, or a name
        // that didn't resolve to a known ParkingLocation).
        query.location = { $regex: args.location, $options: 'i' };
      }
      const slots = await ParkingSlot.find(query)
        .select('slotNumber status slotType location locationId hourlyRate')
        .populate('locationId', 'name');
      const summary = slots.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {});
      const ratesByType = {};
      for (const s of slots) {
        if (!ratesByType[s.slotType]) ratesByType[s.slotType] = { min: s.hourlyRate, max: s.hourlyRate };
        ratesByType[s.slotType].min = Math.min(ratesByType[s.slotType].min, s.hourlyRate);
        ratesByType[s.slotType].max = Math.max(ratesByType[s.slotType].max, s.hourlyRate);
      }
      return {
        total: slots.length,
        scopedToLocationName: await resolveLocationName(locId, args),
        byStatus: summary,
        ratesByType,
        billingNote: 'Minimum 1 hour billed, rounded up to the next hour, at the slot\'s hourly rate.',
        availableSlots: slots.filter((s) => s.status === 'Available').slice(0, 15),
      };
    }
    case 'get_occupancy_insights': {
      const locId = effectiveLocationId(args, ctx);
      const data = await Booking.getOccupancyInsights(90, locId);
      return { ...data, scopedToLocationName: await resolveLocationName(locId, args) };
    }
    case 'get_my_bookings': {
      // Always the latest 5 — "show my recent bookings" should never dump a
      // user's whole booking history into the chat.
      const limit = 5;
      return Booking.find({ userId: ctx.userId })
        .populate('slotId', 'slotNumber location')
        .populate('locationId', 'name')
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('status vehicleCategory vehicleNumber bookingTime checkInTime checkOutTime totalAmount slotId locationId');
    }
    case 'get_my_vehicles': {
      const user = await User.findById(ctx.userId).select('vehicles');
      return user ? user.vehicles : [];
    }
    case 'get_revenue_report': {
      // A location resolved from the message text (e.g. "revenue for Block
      // C this month") narrows to that one site; otherwise this stays the
      // system-wide figure exactly as before, with a per-location
      // breakdown attached so admins can see the split without asking twice.
      if (args.locationId) {
        const single = await Booking.getLocationRevenue(args.locationId, args.startDate, args.endDate);
        return { ...single, scopedToLocationName: await resolveLocationName(args.locationId, args) };
      }
      const [overall, byLocation] = await Promise.all([
        Booking.getRevenue(args.startDate, args.endDate),
        Booking.getRevenueByLocation(args.startDate, args.endDate),
      ]);
      return { ...overall, byLocation };
    }
    case 'get_user_registry_summary': {
      const [byRole, activeCounts, staffByLocation] = await Promise.all([
        User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
        User.aggregate([{ $group: { _id: '$isActive', count: { $sum: 1 } } }]),
        User.aggregate([
          { $match: { role: 'staff', locationId: { $ne: null } } },
          { $group: { _id: '$locationId', count: { $sum: 1 } } },
          { $lookup: { from: 'parkinglocations', localField: '_id', foreignField: '_id', as: 'location' } },
          { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, name: { $ifNull: ['$location.name', 'Unassigned'] }, count: 1 } },
          { $sort: { count: -1 } },
        ]),
      ]);
      return { byRole, activeCounts, staffByLocation };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { runTool };
