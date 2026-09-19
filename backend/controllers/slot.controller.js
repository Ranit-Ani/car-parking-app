const ParkingSlot = require('../models/ParkingSlot');
const BookingService = require('../services/BookingService');

/**
 * SlotController - Handles parking slot operations for users
 */
class SlotController {
  // GET /api/slots - Get all available slots (paginated)
  async getAvailableSlots(req, res, next) {
    try {
      // Self-heal (see BookingService.getUserBookings) — the auto-expiry
      // cron only runs while the process is alive, so on free-tier hosts
      // that spin the process down when idle, a stale "Booked" booking's
      // slot can be stuck showing as unavailable long after its 1-hour
      // window passed. Sweeping here means the very request that wakes
      // the process (e.g. someone opening the app) immediately sees the
      // slot released, instead of waiting on the next cron tick.
      await BookingService.expireStaleBookings();

      const { type, location, locationId } = req.query;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const skip = (page - 1) * limit;

      const filter = { status: 'Available', isActive: true };
      if (type) filter.slotType = type;
      if (location) filter.location = new RegExp(location, 'i');
      // Restrict to a single ParkingLocation - used by the Nearby Parking
      // flow once the user has picked a location to see its available slots.
      if (locationId) filter.locationId = locationId;

      const [slots, total] = await Promise.all([
        ParkingSlot.find(filter).sort({ slotNumber: 1 }).skip(skip).limit(limit).populate('locationId', 'name address geo'),
        ParkingSlot.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: slots.length,
        data: slots,
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + slots.length < total,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/slots/all - Get all slots (with status), paginated
  async getAllSlots(req, res, next) {
    try {
      // Self-heal — see getAvailableSlots() above.
      await BookingService.expireStaleBookings();

      const { status, type, search, locationId } = req.query;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const skip = (page - 1) * limit;

      const filter = { isActive: true };
      if (status) filter.status = status;
      if (type) filter.slotType = type;
      if (locationId) filter.locationId = locationId;
      if (search) {
        const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ slotNumber: re }, { location: re }, { floor: re }];
      }

      const [slots, total] = await Promise.all([
        ParkingSlot.find(filter).sort({ slotNumber: 1 }).skip(skip).limit(limit).populate('locationId', 'name address geo'),
        ParkingSlot.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: slots.length,
        data: slots,
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + slots.length < total,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/slots/:id
  async getSlotById(req, res, next) {
    try {
      const slot = await ParkingSlot.findById(req.params.id).populate('locationId', 'name address geo');
      if (!slot) {
        return res.status(404).json({ success: false, message: 'Slot not found.' });
      }
      res.json({ success: true, data: slot });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/slots/stats
  async getSlotStats(req, res, next) {
    try {
      // Self-heal — see getAvailableSlots() above. This endpoint is public
      // and unauthenticated (no `protect`), so it's often the very first
      // request the landing page makes — a good place to catch up if the
      // process just woke from being idle.
      await BookingService.expireStaleBookings();

      const stats = await ParkingSlot.getSlotStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SlotController();