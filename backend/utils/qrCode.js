const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * QR-based entry system helpers.
 *
 * Design: each booking gets a random, single-use `qrToken` (see
 * models/Booking.js) generated at booking-creation time. The QR code
 * printed/shown to the user simply encodes { b: bookingId, t: qrToken } as
 * JSON — nothing else is derivable from the image itself. All the real
 * security lives on the backend at verification time:
 *   - the token must match the one stored against that exact booking
 *     (timing-safe comparison, so a scanner can't learn the correct value
 *     one byte at a time),
 *   - the booking must still be in "Booked" status (not yet checked in,
 *     not cancelled/expired/completed),
 *   - the booking must not already be flagged qrUsed,
 *   - the booking must not be past its expiresAt window,
 *   - and (for staff accounts) the booking must belong to the staff
 *     member's own assigned parking location.
 * A raw QR image is therefore useless on its own without a live, matching
 * "Booked" record on the server — it can't be replayed, reused, or used at
 * the wrong gate.
 */

// 20 random bytes -> 40 hex chars. Long enough that guessing/brute-forcing
// a valid token for a known bookingId is not practically feasible.
function generateQrToken() {
  return crypto.randomBytes(20).toString('hex');
}

function buildQrPayload(bookingId, token) {
  return JSON.stringify({ b: String(bookingId), t: token });
}

/**
 * Parses whatever a camera scan (or a manual paste, for accessibility)
 * handed us back into a { bookingId, token } pair. Throws a client-safe
 * AppError-shaped error (statusCode set) on anything malformed — the
 * caller doesn't need its own try/catch for JSON.parse().
 */
function parseQrPayload(qrData) {
  let obj;
  try {
    obj = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
  } catch {
    const err = new Error('Invalid QR code. Please rescan.');
    err.statusCode = 400;
    throw err;
  }
  if (!obj || typeof obj.b !== 'string' || typeof obj.t !== 'string' || !obj.b.trim() || !obj.t.trim()) {
    const err = new Error('Invalid QR code. Please rescan.');
    err.statusCode = 400;
    throw err;
  }
  return { bookingId: obj.b, token: obj.t };
}

/**
 * Constant-time string comparison so a mismatched-length or byte-by-byte
 * probing attempt against the stored token doesn't leak timing
 * information. Deliberately returns false (not a throw) on any mismatch
 * in shape, so callers can treat it as a plain boolean check.
 */
function tokensMatch(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length === 0 || bufB.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Renders the booking's QR payload as a scannable PNG data URL. */
async function generateQrImage(bookingId, token) {
  const payload = buildQrPayload(bookingId, token);
  return QRCode.toDataURL(payload, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
}

module.exports = { generateQrToken, buildQrPayload, parseQrPayload, tokensMatch, generateQrImage };
