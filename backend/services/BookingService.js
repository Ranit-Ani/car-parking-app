const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const User = require('../models/User');
const Revenue = require('../models/Revenue');
const BillingService = require('./BillingService');
const { getIO } = require('../socket');
const { isValidVehicleNumber, normalizeVehicleNumber } = require('../utils/vehicleValidation');
const { generateQrToken, generateQrImage } = require('../utils/qrCode');

const ALLOWED_CATEGORIES = ['2 Wheeler', '3 Wheeler', '4 Wheeler'];
const BOOKED_TTL_MS = 60 * 60 * 1000; // Rule 2: 1 hour to check in before auto-expiry

// Multi-location support: staff/admin-facing booking events (new booking,
// cancellation, expiry) should only reach the location's own staff — not
// every staff member system-wide. Admins always get everything. A slot
// with no locationId (legacy data) falls back to the old blanket 'staff'
// broadcast so nothing silently stops working for un-migrated data.
function staffBroadcastTargets(locationId) {
  return locationId ? ['admin', `loc:${locationId}`] : ['admin', 'staff'];
}

/**
 * BookingService - Handles all booking business logic
 * OOP-based service layer following clean architecture
 */
class BookingService {
  /**
   * Create a new booking with all validations.
   *
   * Advance booking has been removed entirely — every booking is for
   * "right now". The booking is created in "Booked" status and must be
   * checked in within 1 hour (see expireStaleBookings), or it will be
   * auto-expired and the slot released.
   *
   * The vehicle can come from one of the user's saved vehicles
   * (pass `vehicleId`) or be entered as a one-off (pass `vehicleCategory`
   * / `vehicleNumber` / `registrationPending` directly).
   *
   * @param {string} userId
   * @param {string} slotId
   * @param {object} vehicleInput
   * @param {string} [vehicleInput.vehicleId] - id of a saved vehicle in User.vehicles
   * @param {string} [vehicleInput.vehicleCategory] - '2 Wheeler' | '3 Wheeler' | '4 Wheeler'
   * @param {string|null} [vehicleInput.vehicleNumber] - required unless registrationPending
   * @param {boolean} [vehicleInput.registrationPending] - true for a brand-new, not-yet-registered vehicle
   * @param {boolean} [vehicleInput.saveVehicle] - if true and no vehicleId given, save this vehicle to the user's account
   * @returns {Promise<Booking>}
   */
  async createBooking(userId, slotId, vehicleInput = {}) {
    const { vehicleId, saveVehicle } = vehicleInput;
    let { vehicleCategory, vehicleNumber, registrationPending } = vehicleInput;

    // Business Rule: A user can have only ONE booking in "Booked" status
    // (awaiting check-in) at a time. Once that booking becomes "Active"
    // (checked in), they're free to create another — for a new or
    // different saved vehicle.
    const hasBooked = await Booking.hasBookedBooking(userId);
    if (hasBooked) {
      const err = new Error('You already have a booking awaiting check-in. Please check in or cancel it first.');
      err.statusCode = 400;
      throw err;
    }

    let resolvedVehicleId = null;

    if (vehicleId) {
      // Booking with a saved vehicle — pull its details from the user's account.
      const user = await User.findById(userId);
      if (!user) {
        const err = new Error('User not found.');
        err.statusCode = 404;
        throw err;
      }
      const vehicle = user.vehicles.id(vehicleId);
      if (!vehicle) {
        const err = new Error('Saved vehicle not found.');
        err.statusCode = 404;
        throw err;
      }
      vehicleCategory = vehicle.category;
      vehicleNumber = vehicle.vehicleNumber;
      registrationPending = vehicle.registrationPending;
      resolvedVehicleId = vehicle._id;
    } else {
      if (!vehicleCategory || !ALLOWED_CATEGORIES.includes(vehicleCategory)) {
        const err = new Error('Select a valid vehicle category (2 Wheeler, 3 Wheeler, or 4 Wheeler).');
        err.statusCode = 400;
        throw err;
      }

      const isPending = !!registrationPending;
      if (!isPending && (!vehicleNumber || !vehicleNumber.trim())) {
        const err = new Error('Vehicle registration number is required, or check "Registration Pending".');
        err.statusCode = 400;
        throw err;
      }
      if (!isPending && !isValidVehicleNumber(vehicleNumber)) {
        const err = new Error('Please enter a valid vehicle registration number.');
        err.statusCode = 400;
        throw err;
      }
      registrationPending = isPending;
      vehicleNumber = isPending ? null : normalizeVehicleNumber(vehicleNumber);

      if (saveVehicle) {
        const user = await User.findById(userId);
        if (user) {
          user.vehicles.push({ category: vehicleCategory, vehicleNumber, registrationPending });
          await user.save();
          resolvedVehicleId = user.vehicles[user.vehicles.length - 1]._id;
        }
      }
    }

    // Business Rule: Slot must be available.
    //
    // This must be a single atomic database operation, not a
    // read-then-write (findById + save). Under concurrent requests for the
    // same slot, two requests could both read status:'Available' before
    // either one writes 'Booked', both pass the check, and both end up
    // creating a Booking for the same slot. findOneAndUpdate() with the
    // 'Available' condition baked into the filter closes that window:
    // MongoDB only lets one matching update through, so only the first
    // request to arrive can flip the slot to 'Booked' — every other
    // concurrent request's filter simply stops matching and gets null back.
    const slot = await ParkingSlot.findOneAndUpdate(
      { _id: slotId, status: 'Available', isActive: true },
      { $set: { status: 'Booked' } },
      { new: true }
    );

    if (!slot) {
      const existing = await ParkingSlot.findById(slotId);
      if (!existing) {
        const err = new Error('Parking slot not found.');
        err.statusCode = 404;
        throw err;
      }
      const err = new Error(`Slot ${existing.slotNumber} is not available. Current status: ${existing.status}`);
      err.statusCode = 400;
      throw err;
    }

    try {
      const now = new Date();
      const booking = await Booking.create({
        userId,
        slotId,
        // Denormalized from the slot so this booking is instantly
        // filterable by location (see the model comment on this field).
        locationId: slot.locationId || null,
        bookingTime: now,
        expiresAt: new Date(now.getTime() + BOOKED_TTL_MS),
        vehicleId: resolvedVehicleId,
        vehicleCategory,
        vehicleNumber,
        registrationPending,
        status: 'Booked',
        // QR-based entry system: every booking gets its own single-use
        // token as soon as it's created, so the QR is ready to show the
        // moment the booking succeeds (see the model comment on qrToken).
        qrToken: generateQrToken(),
      });

      const populated = await booking.populate([
        'userId',
        { path: 'slotId', populate: { path: 'locationId', select: 'name address geo' } },
      ]);

      // Notify every connected client (users, staff, admin) that a slot
      // just changed state, so their slot map / dashboard updates live.
      getIO().emit('slotUpdated', { slotId: slot._id, status: slot.status });
      // Staff need this too (to see it appear on their check-in queue) —
      // but only the staff assigned to this booking's location.
      getIO().to(staffBroadcastTargets(slot.locationId)).emit('bookingCreated', { booking: populated });

      return populated;
    } catch (err) {
      // Rollback slot status on failure
      slot.status = 'Available';
      await slot.save();
      throw err;
    }
  }

  /**
   * Cancel a booking (only before check-in)
   * @param {string} bookingId
   * @param {string} userId
   * @returns {Promise<Booking>}
   */
  async cancelBooking(bookingId, userId, cancelledBy = null, staffLocationId = null) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      throw err;
    }

    // Check ownership (unless admin/staff is cancelling)
    if (!cancelledBy && booking.userId.toString() !== userId.toString()) {
      const err = new Error('Not authorized to cancel this booking.');
      err.statusCode = 403;
      throw err;
    }

    // Multi-location support: a staff member (staffLocationId set) may
    // only cancel bookings that belong to their own assigned location.
    // Admins pass no staffLocationId and bypass this check entirely.
    if (
      cancelledBy &&
      staffLocationId &&
      (!booking.locationId || booking.locationId.toString() !== staffLocationId.toString())
    ) {
      const err = new Error('This booking belongs to a different parking location.');
      err.statusCode = 403;
      throw err;
    }

    // Business Rule: Cannot cancel after check-in
    if (booking.status === 'Active' || booking.checkInTime) {
      const err = new Error('Cannot cancel a booking after check-in.');
      err.statusCode = 400;
      throw err;
    }

    if (booking.status === 'Completed' || booking.status === 'Cancelled' || booking.status === 'Expired') {
      const err = new Error(`Booking is already ${booking.status}.`);
      err.statusCode = 400;
      throw err;
    }

    // Restore slot to Available
    await ParkingSlot.findByIdAndUpdate(booking.slotId, { status: 'Available' });

    booking.status = 'Cancelled';
    booking.cancelledAt = new Date();
    booking.cancelledBy = cancelledBy || userId;
    await booking.save();

    getIO().emit('slotUpdated', { slotId: booking.slotId, status: 'Available' });
    getIO().to(staffBroadcastTargets(booking.locationId)).emit('bookingCancelled', { bookingId: booking._id });

    return booking;
  }

  /**
   * Auto-expire stale "Booked" bookings whose 1-hour check-in window has
   * passed (Rule 2). For each: mark the booking "Expired", cancel it, and
   * release the parking slot back to "Available". Intended to be run on a
   * recurring schedule (see server.js).
   * @returns {Promise<number>} number of bookings expired
   */
  async expireStaleBookings() {
    const now = new Date();
    const stale = await Booking.find({
      status: 'Booked',
      expiresAt: { $ne: null, $lte: now },
    });

    for (const booking of stale) {
      booking.status = 'Expired';
      booking.cancelledAt = now;
      await booking.save();

      await ParkingSlot.findByIdAndUpdate(booking.slotId, { status: 'Available' });

      getIO().emit('slotUpdated', { slotId: booking.slotId, status: 'Available' });
      getIO().emit('bookingUpdated', { bookingId: booking._id, status: 'Expired' });
      getIO().to(staffBroadcastTargets(booking.locationId)).emit('bookingExpired', { bookingId: booking._id });
    }

    return stale.length;
  }

  /**
   * Get bookings for a user, paginated.
   * @param {string} userId
   * @param {object} [opts]
   * @param {number} [opts.page=1]
   * @param {number} [opts.limit=20]
   * @param {string} [opts.status] - optional status filter
   * @returns {Promise<{bookings: Booking[], total: number}>}
   */
  async getUserBookings(userId, opts = {}) {
    const { page = 1, limit = 20, status } = opts;
    const skip = (page - 1) * limit;
    const query = { userId };
    if (status) query.status = status;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate({
          path: 'slotId',
          select: 'slotNumber location floor slotType hourlyRate locationId',
          populate: { path: 'locationId', select: 'name address geo' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query),
    ]);

    return { bookings, total };
  }

  /**
   * Get a single booking with details
   * @param {string} bookingId
   * @returns {Promise<Booking>}
   */
  async getBookingById(bookingId) {
    const booking = await Booking.findById(bookingId)
      .populate('userId', 'name email role')
      .populate({
        path: 'slotId',
        select: 'slotNumber location floor slotType hourlyRate locationId',
        populate: { path: 'locationId', select: 'name address geo' },
      });
    if (!booking) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      throw err;
    }
    return booking;
  }

  /**
   * Get the scannable entry QR for a booking, regenerated fresh on every
   * call from the token stored on the booking (nothing sensitive is ever
   * cached client-side). Additive to the existing manual Check-In flow —
   * this is purely a read of the same booking record.
   * @param {string} bookingId
   * @param {{_id: string, role: string}} requestingUser - same ownership
   *   rule as getBookingById()/downloadReceipt(): a plain user may only
   *   fetch their own booking's QR; staff/admin may fetch any.
   * @returns {Promise<{qrImage: string, status: string, qrUsed: boolean, expiresAt: Date|null}>}
   */
  async getBookingQRImage(bookingId, requestingUser) {
    const booking = await Booking.findById(bookingId).select('+qrToken');
    if (!booking) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      throw err;
    }

    if (requestingUser.role === 'user' && booking.userId.toString() !== requestingUser._id.toString()) {
      const err = new Error('Not authorized.');
      err.statusCode = 403;
      throw err;
    }

    if (!booking.qrToken) {
      const err = new Error('QR code is not available for this booking.');
      err.statusCode = 400;
      throw err;
    }

    const qrImage = await generateQrImage(booking._id, booking.qrToken);

    return {
      qrImage,
      status: booking.status,
      qrUsed: booking.qrUsed,
      expiresAt: booking.expiresAt,
    };
  }
}

module.exports = new BookingService();