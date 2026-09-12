const StaffService = require('../services/StaffService');
const BookingService = require('../services/BookingService');

/**
 * StaffController - Handles check-in/check-out for parking staff
 *
 * Multi-location support: every method below is reachable by both 'staff'
 * and 'admin' (see routes/staff.routes.js). A staff account always carries
 * req.user.locationId and is locked to it. An admin account has no
 * locationId, so passing it straight through naturally means "no location
 * restriction" for admins, while staff are transparently scoped to their
 * own assigned location.
 */
class StaffController {
  // POST /api/staff/checkin/:bookingId
  async checkIn(req, res, next) {
    try {
      const booking = await StaffService.checkIn(req.params.bookingId, req.user.locationId);
      res.json({
        success: true,
        message: `Check-in successful for slot ${booking.slotId.slotNumber}.`,
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/staff/checkout/:bookingId
  async checkOut(req, res, next) {
    try {
      const { booking, bill } = await StaffService.checkOut(req.params.bookingId, req.user.locationId);
      res.json({
        success: true,
        message: `Check-out successful. Total amount: ₹${bill.totalAmount}`,
        data: {
          booking,
          bill,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/staff/bookings - All active bookings (paginated)
  async getActiveBookings(req, res, next) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      // A staff member is always locked to their own location. An admin
      // has no locationId of their own, but may explicitly ask to view one
      // location's queue (e.g. drilling into a location from the Admin
      // Locations page) via ?locationId=.
      const locationId = req.user.locationId || (req.user.role === 'admin' ? req.query.locationId : undefined);

      const { bookings, total } = await StaffService.getActiveBookings({ page, limit, locationId });
      res.json({
        success: true,
        count: bookings.length,
        data: bookings,
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: (page - 1) * limit + bookings.length < total,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/staff/bookings/all (paginated)
  async getAllBookings(req, res, next) {
    try {
      const { status, date } = req.query;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const locationId = req.user.locationId || (req.user.role === 'admin' ? req.query.locationId : undefined);

      const { bookings, total } = await StaffService.getAllBookings({ status, date, page, limit, locationId });
      res.json({
        success: true,
        count: bookings.length,
        data: bookings,
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: (page - 1) * limit + bookings.length < total,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/staff/stats - Slot status counts, scoped to the caller's
  // location if they have one (staff), otherwise system-wide (admin).
  async getStats(req, res, next) {
    try {
      const locationId = req.user.locationId || (req.user.role === 'admin' ? req.query.locationId : undefined);
      const stats = await StaffService.getSlotStats(locationId);
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  // ─── QR-based entry system (additive; manual check-in above is unchanged) ──

  // POST /api/staff/qr/verify - Verify a scanned booking QR and return the
  // booking/vehicle details for staff to review, WITHOUT checking in yet.
  async verifyQR(req, res, next) {
    try {
      const booking = await StaffService.verifyQRToken(req.body.qrData, req.user.locationId);
      res.json({
        success: true,
        message: 'QR code verified.',
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/staff/qr/checkin - Verify + check-in in one step; marks the
  // QR as used so it cannot be scanned again.
  async checkInByQR(req, res, next) {
    try {
      const booking = await StaffService.checkInByQR(req.body.qrData, req.user.locationId);
      res.json({
        success: true,
        message: `Check-in successful for slot ${booking.slotId.slotNumber}.`,
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/staff/cancel/:bookingId - Staff-initiated cancel
  async cancelBooking(req, res, next) {
    try {
      const booking = await BookingService.cancelBooking(
        req.params.bookingId,
        null,
        req.user._id,
        req.user.locationId
      );
      res.json({
        success: true,
        message: 'Booking cancelled by staff.',
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StaffController();
