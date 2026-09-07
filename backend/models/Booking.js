const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      required: [true, 'Parking slot is required'],
    },
    // Denormalized from the slot at booking time (multi-location support).
    // Stored directly on the booking — rather than always joining through
    // slotId — so location-scoped queries (a staff member's own bookings,
    // per-location revenue) are a simple indexed match instead of a slot
    // lookup on every request. Null for bookings on slots that aren't
    // linked to a ParkingLocation (legacy data).
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      default: null,
    },
    bookingTime: {
      type: Date,
      default: Date.now,
    },
    // Bookings are always for "now" — advance/scheduled booking has been
    // removed. A booking stays in "Booked" status for at most 1 hour;
    // if check-in doesn't happen before expiresAt, it is auto-expired
    // (see BookingService.expireStaleBookings).
    expiresAt: {
      type: Date,
      default: null,
    },
    vehicleId: {
      // Reference to the subdocument in User.vehicles that was used for
      // this booking (if the user picked a saved vehicle). Null when the
      // user typed in a one-off vehicle that wasn't saved.
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    vehicleCategory: {
      type: String,
      enum: ['2 Wheeler', '3 Wheeler', '4 Wheeler'],
      required: [true, 'Vehicle category is required'],
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 20,
      default: null,
    },
    registrationPending: {
      type: Boolean,
      default: false,
    },
    checkInTime: {
      type: Date,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Booked', 'Cancelled', 'Completed', 'Active', 'Expired'],
      default: 'Booked',
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ slotId: 1, status: 1 });
BookingSchema.index({ status: 1, expiresAt: 1 });
// Powers a staff member's "my location's bookings" queries and per-location
// revenue/booking aggregation for the admin.
BookingSchema.index({ locationId: 1, status: 1 });

// ─── Virtual: Duration in readable format ─────────────────────────────────────
BookingSchema.virtual('durationFormatted').get(function () {
  if (!this.checkInTime || !this.checkOutTime) return null;
  const diff = this.checkOutTime - this.checkInTime;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
});

// ─── Static: Check for an unresolved "Booked" booking for user ────────────────
// Business rule: a user may only have ONE booking in "Booked" status at a
// time (i.e. awaiting check-in). Once that booking becomes "Active" (the
// user has checked in), they are free to create a new booking for another
// vehicle — so "Active" bookings do NOT block new bookings.
BookingSchema.statics.hasBookedBooking = async function (userId) {
  const booking = await this.findOne({
    userId,
    status: 'Booked',
  });
  return !!booking;
};

// ─── Static: Revenue aggregation ──────────────────────────────────────────────
BookingSchema.statics.getRevenue = async function (startDate, endDate) {
  const match = { status: 'Completed' };
  if (startDate && endDate) {
    match.checkOutTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalBookings: { $sum: 1 },
        avgAmount: { $avg: '$totalAmount' },
      },
    },
  ]);
  return result[0] || { totalRevenue: 0, totalBookings: 0, avgAmount: 0 };
};

// ─── Static: Daily revenue ────────────────────────────────────────────────────
BookingSchema.statics.getDailyRevenue = async function (days = 7) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  return this.aggregate([
    { $match: { status: 'Completed', checkOutTime: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkOutTime' } },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

// ─── Static: Revenue broken down by parking location ──────────────────────────
// Feeds the Admin Revenue page's location-wise revenue section. This is
// ADDITIVE alongside getRevenue()/getDailyRevenue() above — those keep
// powering the existing "Overall Revenue" figures unchanged.
BookingSchema.statics.getRevenueByLocation = async function (startDate, endDate) {
  const match = { status: 'Completed' };
  if (startDate && endDate) {
    match.checkOutTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$locationId',
        totalRevenue: { $sum: '$totalAmount' },
        totalBookings: { $sum: 1 },
        avgAmount: { $avg: '$totalAmount' },
      },
    },
    {
      $lookup: {
        from: 'parkinglocations',
        localField: '_id',
        foreignField: '_id',
        as: 'location',
      },
    },
    { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        locationId: '$_id',
        name: { $ifNull: ['$location.name', 'Unassigned'] },
        totalRevenue: 1,
        totalBookings: 1,
        avgAmount: 1,
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);
};

// ─── Static: Revenue summary for ONE parking location ─────────────────────────
BookingSchema.statics.getLocationRevenue = async function (locationId, startDate, endDate) {
  const match = { status: 'Completed', locationId: new mongoose.Types.ObjectId(locationId) };
  if (startDate && endDate) {
    match.checkOutTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalBookings: { $sum: 1 },
        avgAmount: { $avg: '$totalAmount' },
      },
    },
  ]);
  return result[0] || { totalRevenue: 0, totalBookings: 0, avgAmount: 0 };
};

// ─── Static: Daily revenue for ONE parking location ───────────────────────────
BookingSchema.statics.getDailyRevenueForLocation = async function (locationId, days = 30) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  return this.aggregate([
    {
      $match: {
        status: 'Completed',
        locationId: new mongoose.Types.ObjectId(locationId),
        checkOutTime: { $gte: start },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkOutTime' } },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

// ─── Static: Occupancy insights (peak hours / days / busiest slots) ──────────
// Feeds the AI assistant's get_occupancy_insights tool, so the model owns the
// aggregation once instead of duplicating it elsewhere.
// Optional `locationId` scopes every aggregation to a single parking
// location (multi-location support) — used for staff, whose insights should
// only reflect their own location, and for admins asking about a specific
// site by name. Omitted, this returns system-wide insights exactly as before.
BookingSchema.statics.getOccupancyInsights = async function (days = 90, locationId = null) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const match = { bookingTime: { $gte: start } };
  if (locationId) match.locationId = new mongoose.Types.ObjectId(locationId);

  const durationMatch = { status: 'Completed', checkInTime: { $ne: null }, checkOutTime: { $ne: null } };
  if (locationId) durationMatch.locationId = new mongoose.Types.ObjectId(locationId);

  const [byHour, byDay, avgDuration, topSlots] = await Promise.all([
    this.aggregate([
      { $match: match },
      { $group: { _id: { $hour: '$bookingTime' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: { $dayOfWeek: '$bookingTime' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    this.aggregate([
      { $match: durationMatch },
      { $project: { minutes: { $divide: [{ $subtract: ['$checkOutTime', '$checkInTime'] }, 60000] } } },
      { $group: { _id: null, avgMinutes: { $avg: '$minutes' } } },
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: '$slotId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'parkingslots', localField: '_id', foreignField: '_id', as: 'slot' } },
      { $unwind: { path: '$slot', preserveNullAndEmptyArrays: true } },
      { $project: { count: 1, slotNumber: '$slot.slotNumber', location: '$slot.location' } },
    ]),
  ]);

  const DAY_NAMES = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    windowDays: days,
    scopedToLocationId: locationId ? String(locationId) : null,
    peakHours: byHour.slice(0, 3).map((h) => ({ hour: h._id, count: h.count })),
    quietHours: [...byHour].sort((a, b) => a.count - b.count).slice(0, 3).map((h) => ({ hour: h._id, count: h.count })),
    busiestDays: byDay.map((d) => ({ day: DAY_NAMES[d._id], count: d.count })),
    avgSessionMinutes: avgDuration[0] ? Math.round(avgDuration[0].avgMinutes) : null,
    topSlots,
  };
};

module.exports = mongoose.model('Booking', BookingSchema);