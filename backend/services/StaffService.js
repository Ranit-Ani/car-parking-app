const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const Revenue = require('../models/Revenue');
const BillingService = require('./BillingService');
const { getIO } = require('../socket');

/**
 * StaffService - Handles check-in/check-out operations
 * Only accessible by Parking Staff and Admins
 */
class StaffService {
  /**
   * Perform Check-In: Booked → Active (Occupied)
   * @param {string} bookingId
   * @param {string|null} [staffLocationId] - if set, the booking must
   *   belong to this location (multi-location support: a staff member can
   *   only operate on bookings for their own assigned location). Admins
   *   pass null/undefined to bypass this check.
   * @returns {Promise<Booking>}
   */
  async checkIn(bookingId, staffLocationId = null) {
    const booking = await Booking.findById(bookingId).populate('slotId');
    if (!booking) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      throw err;
    }

    if (
      staffLocationId &&
      (!booking.locationId || booking.locationId.toString() !== staffLocationId.toString())
    ) {
      const err = new Error('This booking belongs to a different parking location.');
      err.statusCode = 403;
      throw err;
    }

    if (booking.status !== 'Booked') {
      const err = new Error(`Cannot check-in. Booking status is: ${booking.status}`);
      err.statusCode = 400;
      throw err;
    }

    // Update booking
    booking.status = 'Active';
    booking.checkInTime = new Date();
    await booking.save();

    // Update slot status to Occupied
    await ParkingSlot.findByIdAndUpdate(booking.slotId._id, { status: 'Occupied' });

    getIO().emit('slotUpdated', { slotId: booking.slotId._id, status: 'Occupied' });
    getIO().emit('bookingUpdated', { bookingId: booking._id, status: 'Active' });

    return await booking.populate(['userId', 'slotId']);
  }

  /**
   * Perform Check-Out: Active → Completed + Generate Bill
   * @param {string} bookingId
   * @param {string|null} [staffLocationId] - see checkIn() above.
   * @returns {Promise<{booking, bill}>}
   */
  async checkOut(bookingId, staffLocationId = null) {
    const booking = await Booking.findById(bookingId).populate('slotId');
    if (!booking) {
      const err = new Error('Booking not found.');
      err.statusCode = 404;
      throw err;
    }

    if (
      staffLocationId &&
      (!booking.locationId || booking.locationId.toString() !== staffLocationId.toString())
    ) {
      const err = new Error('This booking belongs to a different parking location.');
      err.statusCode = 403;
      throw err;
    }

    if (booking.status !== 'Active') {
      const err = new Error(`Cannot check-out. Booking status is: ${booking.status}`);
      err.statusCode = 400;
      throw err;
    }

    if (!booking.checkInTime) {
      const err = new Error('No check-in time recorded for this booking.');
      err.statusCode = 400;
      throw err;
    }

    const checkOutTime = new Date();

    // Use BillingService to calculate bill
    const billing = BillingService.create(booking.slotId.hourlyRate);
    const bill = billing.calculateBill(booking.checkInTime, checkOutTime);

    // Update booking
    booking.checkOutTime = checkOutTime;
    booking.totalHours = bill.roundedHours;
    booking.totalAmount = bill.totalAmount;
    booking.status = 'Completed';
    await booking.save();

    // Restore slot to Available
    await ParkingSlot.findByIdAndUpdate(booking.slotId._id, { status: 'Available' });

    // Record Revenue
    await Revenue.create({
      bookingId: booking._id,
      userId: booking.userId,
      slotId: booking.slotId._id,
      amount: bill.totalAmount,
      hours: bill.roundedHours,
      hourlyRate: booking.slotId.hourlyRate,
    });

    getIO().emit('slotUpdated', { slotId: booking.slotId._id, status: 'Available' });
    getIO().emit('bookingUpdated', { bookingId: booking._id, status: 'Completed' });
    getIO().to('admin').emit('revenueUpdated', { amount: bill.totalAmount });

    return {
      booking: await booking.populate(['userId', 'slotId']),
      bill,
    };
  }

  /**
   * Get all active (checked-in) bookings, paginated.
   * @param {object} [opts]
   * @param {number} [opts.page=1]
   * @param {number} [opts.limit=30]
   * @param {string|null} [opts.locationId] - multi-location support: when
   *   set, only bookings for this parking location are returned (a staff
   *   member's own assigned location). Omitted/null returns every
   *   location's bookings (admin view).
   * @returns {Promise<{bookings: Booking[], total: number}>}
   */
  async getActiveBookings(opts = {}) {
    const { page = 1, limit = 30, locationId } = opts;
    const skip = (page - 1) * limit;
    const query = { status: { $in: ['Booked', 'Active'] } };
    if (locationId) query.locationId = locationId;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('userId', 'name email role')
        .populate('slotId', 'slotNumber location floor slotType')
        .sort({ bookingTime: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query),
    ]);

    return { bookings, total };
  }

  /**
   * Get all bookings (for staff/admin view), paginated.
   * @param {object} [filters]
   * @param {string} [filters.status]
   * @param {string} [filters.date]
   * @param {string|null} [filters.locationId] - see getActiveBookings() above.
   * @param {number} [filters.page=1]
   * @param {number} [filters.limit=30]
   * @returns {Promise<{bookings: Booking[], total: number}>}
   */
  async getAllBookings(filters = {}) {
    const { page = 1, limit = 30 } = filters;
    const skip = (page - 1) * limit;
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.locationId) query.locationId = filters.locationId;
    if (filters.date) {
      const start = new Date(filters.date);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      query.bookingTime = { $gte: start, $lte: end };
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('userId', 'name email role')
        .populate('slotId', 'slotNumber location floor slotType hourlyRate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query),
    ]);

    return { bookings, total };
  }

  /**
   * Slot status counts, optionally scoped to one parking location.
   * Powers the staff dashboard's "SLOT STATUS MATRIX" — a staff member
   * should only see their own location's slot numbers, not the whole
   * system's (see /api/staff/stats vs the system-wide /api/slots/stats).
   * @param {string|null} [locationId]
   */
  async getSlotStats(locationId = null) {
    return ParkingSlot.getSlotStats(locationId || undefined);
  }
}

module.exports = new StaffService();
