const User = require('../models/User');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');
const Booking = require('../models/Booking');
const Revenue = require('../models/Revenue');
const BookingService = require('./BookingService');
const { getIO } = require('../socket');

function parseAmenities(amenities) {
  if (amenities === undefined) return undefined;
  if (Array.isArray(amenities)) return amenities.map((a) => String(a).trim()).filter(Boolean);
  return String(amenities).split(',').map((a) => a.trim()).filter(Boolean);
}

function parseLatLng(latitude, longitude) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const err = new Error('Please provide a valid latitude (-90 to 90) and longitude (-180 to 180).');
    err.statusCode = 400;
    throw err;
  }
  return { lat, lng };
}

// Pushed straight at one specific logged-in user (see socket.js's
// `user:<id>` room) the instant an admin action invalidates their current
// session — role/location change or deactivation. This is purely a
// "notify them right now" nicety so they don't have to wait for their next
// API call to discover it; the actual security enforcement is the
// tokenVersion/isActive check in auth.middleware.js's `protect`, which
// still runs regardless of whether this event ever arrives (dropped
// socket messages, the user being offline, etc. can never leave stale
// access in place).
function invalidateUserSession(userId, code, message) {
  try {
    getIO().to(`user:${userId}`).emit('sessionInvalidated', { code, message });
  } catch {
    // getIO() throws if socket.io hasn't been initialized (e.g. some test
    // contexts) — the REST-layer check is the real guarantee, so a missing
    // socket server here should never block the admin action itself.
  }
}

/**
 * AdminService - Admin dashboard and management operations
 */
class AdminService {
  // ─── Dashboard Stats ─────────────────────────────────────────────────────────
  async getDashboardStats() {
    // Self-heal (see BookingService.getUserBookings) — the auto-expiry
    // cron only runs while the process is alive, so a dashboard load is
    // also a good moment to sweep for stale "Booked" bookings the cron
    // may have missed, so "Active Bookings" and occupancy % stay accurate.
    await BookingService.expireStaleBookings();

    const [slotStats, revenue, activeBookings, totalUsers] = await Promise.all([
      ParkingSlot.getSlotStats(),
      Booking.getRevenue(),
      Booking.countDocuments({ status: { $in: ['Booked', 'Active'] } }),
      User.countDocuments({ role: 'user', isEmailVerified: true }),
    ]);

    const occupancyRate =
      slotStats.total > 0
        ? (((slotStats.Booked + slotStats.Occupied) / slotStats.total) * 100).toFixed(1)
        : 0;

    return {
      slots: slotStats,
      revenue,
      activeBookings,
      totalUsers,
      occupancyRate: parseFloat(occupancyRate),
    };
  }

  // ─── Revenue Analytics ────────────────────────────────────────────────────────
  // `summary` and `daily` are computed exactly as before (drives the
  // existing "Overall Revenue" figures on the Admin Revenue page — do not
  // change their shape). `locationBreakdown` is a new, additive field with
  // per-location totals so the page can show location-wise revenue
  // alongside the overall figures, not instead of them.
  async getRevenueReport(startDate, endDate) {
    const [summary, daily, locationBreakdown] = await Promise.all([
      Booking.getRevenue(startDate, endDate),
      Booking.getDailyRevenue(30),
      Booking.getRevenueByLocation(startDate, endDate),
    ]);
    return { summary, daily, locationBreakdown };
  }

  // ─── Per-location detail (revenue, bookings, occupancy) ───────────────────────
  // Powers "open a parking location and see its individual revenue,
  // bookings, and stats" from the Admin Locations page.
  async getLocationDetail(locationId, startDate, endDate) {
    const location = await ParkingLocation.findById(locationId);
    if (!location) {
      const err = new Error('Parking location not found.');
      err.statusCode = 404;
      throw err;
    }

    const [slotStats, revenue, daily, activeBookings, completedBookings, staffCount] = await Promise.all([
      ParkingSlot.getSlotStats(locationId),
      Booking.getLocationRevenue(locationId, startDate, endDate),
      Booking.getDailyRevenueForLocation(locationId, 30),
      Booking.countDocuments({ locationId, status: { $in: ['Booked', 'Active'] } }),
      Booking.countDocuments({ locationId, status: 'Completed' }),
      User.countDocuments({ role: 'staff', locationId }),
    ]);

    const occupancyRate =
      slotStats.total > 0
        ? (((slotStats.Booked + slotStats.Occupied) / slotStats.total) * 100).toFixed(1)
        : 0;

    return {
      location,
      slots: slotStats,
      revenue,
      daily,
      activeBookings,
      completedBookings,
      staffCount,
      occupancyRate: parseFloat(occupancyRate),
    };
  }

  // ─── Location Wise Revenue — combined initial load ─────────────────────────
  // The Location Wise Revenue page needs two things before it can paint:
  // the location list (to populate the picker) and the detail for whichever
  // location ends up selected by default (the first one). Fetching those as
  // two separate round trips from the client (list, THEN detail once the
  // list resolves) is what made this page visibly slower to first paint
  // than the single-request Overall Revenue page. This bundles both into
  // one request/response so the client only waits on one round trip.
  async getLocationsOverview(startDate, endDate) {
    const locations = await this.listLocations();
    if (!locations.length) return { locations, detail: null };
    const detail = await this.getLocationDetail(locations[0]._id, startDate, endDate);
    return { locations, detail };
  }

  // ─── User Management ──────────────────────────────────────────────────────────
  // `role` optionally narrows the list to one role ('admin' | 'staff' | 'user') —
  // powers the Manage Users page's User/Staff/Admin selector. `locationId`
  // additionally scopes to one parking location — only meaningful for
  // 'staff' (every staff account is tied to exactly one location). Regular
  // 'user' accounts can book at any location, so they're never
  // location-scoped.
  async getAllUsers(page = 1, limit = 20, role, locationId) {
    const skip = (page - 1) * limit;
    // Only show accounts that actually completed OTP verification.
    // Records created by /register/initiate but never verified are
    // pending signups, not real users, and should not appear here.
    // Soft-deleted accounts (see User.isDeleted) are excluded too — their
    // personal fields have been anonymized, so they'd otherwise show up
    // here as a confusing "Deleted User" row; their bookings remain
    // visible elsewhere via the userName/userEmail snapshot on Booking.
    const filter = { isEmailVerified: true, isDeleted: { $ne: true } };
    if (role && ['admin', 'staff', 'user'].includes(role)) filter.role = role;

    if (locationId && filter.role === 'staff') {
      filter.locationId = locationId;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .populate('locationId', 'name') // so the Staff table can show each member's assigned location
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);
    return { users, total, page, pages: Math.ceil(total / limit) };
  }

  // `locationId` is required when (and only relevant when) promoting a
  // user to 'staff' — every staff member must be linked to exactly one
  // parking location. Changing a staff member's role away from 'staff'
  // clears their locationId, since it's not a staff account anymore.
  async updateUserRole(userId, role, locationId) {
    const validRoles = ['admin', 'staff', 'user'];
    if (!validRoles.includes(role)) {
      const err = new Error('Invalid role specified.');
      err.statusCode = 400;
      throw err;
    }

    const existing = await User.findById(userId);
    if (!existing) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const update = { role };
    if (role === 'staff') {
      if (!locationId) {
        const err = new Error('Please select a parking location for this staff member.');
        err.statusCode = 400;
        throw err;
      }
      const loc = await ParkingLocation.findById(locationId);
      if (!loc) {
        const err = new Error('Selected parking location was not found.');
        err.statusCode = 400;
        throw err;
      }
      update.locationId = loc._id;
    } else {
      update.locationId = null;
    }

    // Security: any actual change to what this user is allowed to do (role
    // itself, or which location a staff member is scoped to) must kill
    // their current session, not just relabel it. Bumping tokenVersion
    // makes `protect` reject their existing JWT on the very next request
    // — see auth.middleware.js — forcing them to log back in and pick up
    // the new role. A no-op update (admin re-saves the same role/location)
    // intentionally does NOT bump it, so we don't log someone out for no
    // reason.
    const roleChanged = existing.role !== role;
    const locationChanged = String(existing.locationId || '') !== String(update.locationId || '');

    // $set and $inc can't be mixed with plain top-level fields in the same
    // MongoDB update document, so build it explicitly rather than bolting
    // $inc onto the plain `update` object above.
    const mongoUpdate = { $set: update };
    if (roleChanged || locationChanged) {
      mongoUpdate.$inc = { tokenVersion: 1 };
    }

    const user = await User.findByIdAndUpdate(
      userId,
      mongoUpdate,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    if (roleChanged || locationChanged) {
      invalidateUserSession(
        user._id,
        'SESSION_INVALIDATED',
        'Your session has been terminated because your account role or permissions were changed by an administrator. Please log in again.'
      );
    }

    getIO().to('admin').emit('userUpdated', { userId: user._id, role: user.role, locationId: user.locationId });

    return user;
  }

  async toggleUserStatus(userId) {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }
    user.isActive = !user.isActive;
    await user.save();

    // Deactivating someone should kick them out just as instantly as a
    // role change does. `protect` already rejects the very next request
    // from a deactivated account (isActive check), so this socket push is
    // just what makes it immediate instead of waiting on that next
    // request — see invalidateUserSession's doc comment above.
    if (!user.isActive) {
      invalidateUserSession(user._id, 'ACCOUNT_DEACTIVATED', 'Your account has been deactivated by an administrator.');
    }

    getIO().to('admin').emit('userUpdated', { userId: user._id, isActive: user.isActive });

    return user;
  }

  // ─── Slot Management ──────────────────────────────────────────────────────────
  async createSlot(slotData) {
    const exists = await ParkingSlot.findOne({ slotNumber: slotData.slotNumber.toUpperCase() });
    if (exists) {
      const err = new Error(`Slot ${slotData.slotNumber} already exists.`);
      err.statusCode = 400;
      throw err;
    }

    // A slot linked to a ParkingLocation keeps its legacy `location` text
    // field in sync with that location's name, so older UI/reports that
    // just read `location` as a plain string keep working unchanged.
    if (slotData.locationId) {
      const loc = await ParkingLocation.findById(slotData.locationId);
      if (!loc) {
        const err = new Error('Selected parking location was not found.');
        err.statusCode = 400;
        throw err;
      }
      slotData.location = loc.name;
    }

    const slot = await ParkingSlot.create(slotData);
    getIO().emit('slotUpdated', { slotId: slot._id, status: slot.status, created: true });
    return slot;
  }

  async updateSlot(slotId, updateData) {
    if (updateData.locationId) {
      const loc = await ParkingLocation.findById(updateData.locationId);
      if (!loc) {
        const err = new Error('Selected parking location was not found.');
        err.statusCode = 400;
        throw err;
      }
      updateData.location = loc.name;
    }

    const slot = await ParkingSlot.findByIdAndUpdate(slotId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!slot) {
      const err = new Error('Slot not found.');
      err.statusCode = 404;
      throw err;
    }

    getIO().emit('slotUpdated', { slotId: slot._id, status: slot.status, hourlyRate: slot.hourlyRate });

    return slot;
  }

  async deleteSlot(slotId) {
    const slot = await ParkingSlot.findById(slotId);
    if (!slot) {
      const err = new Error('Slot not found.');
      err.statusCode = 404;
      throw err;
    }

    if (slot.status === 'Booked' || slot.status === 'Occupied') {
      const err = new Error('Cannot delete a slot that is currently in use.');
      err.statusCode = 400;
      throw err;
    }

    await slot.deleteOne();
    getIO().emit('slotDeleted', { slotId });
    return { message: 'Slot deleted successfully.' };
  }

  async updateSlotPricing(slotId, hourlyRate) {
    if (hourlyRate < 0) {
      const err = new Error('Hourly rate cannot be negative.');
      err.statusCode = 400;
      throw err;
    }
    return this.updateSlot(slotId, { hourlyRate });
  }

  // ─── Parking Location Management (multi-location support) ─────────────────────
  async listLocations() {
    const [locations, slotCounts, staffCounts] = await Promise.all([
      ParkingLocation.find().sort({ name: 1 }),
      ParkingSlot.aggregate([
        {
          $group: {
            _id: '$locationId',
            totalSlots: { $sum: 1 },
            availableSlots: { $sum: { $cond: [{ $eq: ['$status', 'Available'] }, 1, 0] } },
          },
        },
      ]),
      User.aggregate([
        { $match: { role: 'staff', locationId: { $ne: null } } },
        { $group: { _id: '$locationId', count: { $sum: 1 } } },
      ]),
    ]);

    const byId = new Map(slotCounts.filter((c) => c._id).map((c) => [c._id.toString(), c]));
    const staffById = new Map(staffCounts.map((c) => [c._id.toString(), c.count]));

    return locations.map((loc) => {
      const obj = loc.toObject();
      const c = byId.get(loc._id.toString());
      obj.totalSlots = c ? c.totalSlots : 0;
      obj.availableSlots = c ? c.availableSlots : 0;
      obj.staffCount = staffById.get(loc._id.toString()) || 0;
      return obj;
    });
  }

  async createLocation(data) {
    const { name, address, description, amenities, latitude, longitude } = data;
    if (!name || !name.trim()) {
      const err = new Error('Location name is required.');
      err.statusCode = 400;
      throw err;
    }
    const { lat, lng } = parseLatLng(latitude, longitude);

    const location = await ParkingLocation.create({
      name: name.trim(),
      address: (address || '').trim(),
      description: (description || '').trim(),
      amenities: parseAmenities(amenities) || [],
      geo: { type: 'Point', coordinates: [lng, lat] },
    });

    getIO().emit('locationUpdated', { locationId: location._id, created: true });
    return location;
  }

  async updateLocation(locationId, data) {
    const update = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.address !== undefined) update.address = data.address.trim();
    if (data.description !== undefined) update.description = data.description.trim();
    if (data.amenities !== undefined) update.amenities = parseAmenities(data.amenities);
    if (data.isActive !== undefined) update.isActive = !!data.isActive;
    if (data.latitude !== undefined && data.longitude !== undefined) {
      const { lat, lng } = parseLatLng(data.latitude, data.longitude);
      update.geo = { type: 'Point', coordinates: [lng, lat] };
    }

    const location = await ParkingLocation.findByIdAndUpdate(locationId, update, {
      new: true,
      runValidators: true,
    });
    if (!location) {
      const err = new Error('Parking location not found.');
      err.statusCode = 404;
      throw err;
    }

    // Slots linked to this location display its name, so keep them in sync
    // if the name changed.
    if (update.name) {
      await ParkingSlot.updateMany({ locationId: location._id }, { location: update.name });
    }

    getIO().emit('locationUpdated', { locationId: location._id });
    return location;
  }

  async deleteLocation(locationId) {
    const slotCount = await ParkingSlot.countDocuments({ locationId });
    if (slotCount > 0) {
      const err = new Error('Cannot delete a location that still has parking slots assigned to it. Reassign or remove those slots first.');
      err.statusCode = 400;
      throw err;
    }

    const staffCount = await User.countDocuments({ role: 'staff', locationId });
    if (staffCount > 0) {
      const err = new Error('Cannot delete a location that still has staff assigned to it. Reassign or remove those staff members first.');
      err.statusCode = 400;
      throw err;
    }

    const location = await ParkingLocation.findByIdAndDelete(locationId);
    if (!location) {
      const err = new Error('Parking location not found.');
      err.statusCode = 404;
      throw err;
    }

    getIO().emit('locationDeleted', { locationId });
    return { message: 'Parking location deleted successfully.' };
  }

  // ─── Per-location Staff Management (multi-location support) ────────────────────
  // GET-style: every staff member assigned to this location.
  async getLocationStaff(locationId) {
    const loc = await ParkingLocation.findById(locationId);
    if (!loc) {
      const err = new Error('Parking location not found.');
      err.statusCode = 404;
      throw err;
    }
    return User.find({ role: 'staff', locationId }).select('-password').sort({ createdAt: -1 });
  }

  // Creates a brand-new staff account, pre-verified and pre-assigned to
  // this location (skips the OTP flow — an admin vouching for the account
  // is the verification here, same as how admin/staff accounts are seeded).
  async addLocationStaff(locationId, data) {
    const loc = await ParkingLocation.findById(locationId);
    if (!loc) {
      const err = new Error('Parking location not found.');
      err.statusCode = 404;
      throw err;
    }

    const { name, email, password } = data;
    if (!name || !name.trim()) {
      const err = new Error('Staff name is required.');
      err.statusCode = 400;
      throw err;
    }
    if (!email || !email.trim()) {
      const err = new Error('Staff email is required.');
      err.statusCode = 400;
      throw err;
    }
    if (!password || password.length < 6) {
      const err = new Error('Password must be at least 6 characters.');
      err.statusCode = 400;
      throw err;
    }

    const normalEmail = email.toLowerCase().trim();
    const exists = await User.findOne({ email: normalEmail });
    if (exists) {
      const err = new Error('A user with this email already exists.');
      err.statusCode = 409;
      throw err;
    }

    const staff = await User.create({
      name: name.trim(),
      email: normalEmail,
      password,
      role: 'staff',
      locationId: loc._id,
      isEmailVerified: true,
      isActive: true,
    });

    const obj = staff.toObject();
    delete obj.password;

    getIO().to('admin').emit('staffUpdated', { locationId, staffId: staff._id, created: true });
    return obj;
  }

  // Edits a staff member's name/active-status, and/or reassigns them to a
  // different parking location. Scoped to `locationId` so an admin can
  // only edit staff through the location they're currently managing them
  // from (matches the "manage staff assigned to that location" UI flow).
  async updateLocationStaff(locationId, staffId, data) {
    const staff = await User.findOne({ _id: staffId, role: 'staff', locationId });
    if (!staff) {
      const err = new Error('Staff member not found for this location.');
      err.statusCode = 404;
      throw err;
    }

    if (data.name !== undefined && data.name.trim()) staff.name = data.name.trim();

    const wasActive = staff.isActive;
    if (data.isActive !== undefined) staff.isActive = !!data.isActive;

    let locationReassigned = false;
    if (data.newLocationId !== undefined && data.newLocationId) {
      const newLoc = await ParkingLocation.findById(data.newLocationId);
      if (!newLoc) {
        const err = new Error('Selected parking location was not found.');
        err.statusCode = 400;
        throw err;
      }
      if (String(staff.locationId || '') !== String(newLoc._id)) {
        // Reassigning a staff member to a different location changes what
        // they're allowed to see/manage just as much as a role change does
        // (StaffService scopes everything by locationId) — invalidate
        // their existing session the same way.
        staff.tokenVersion = (staff.tokenVersion || 0) + 1;
        locationReassigned = true;
      }
      staff.locationId = newLoc._id;
    }

    await staff.save();

    if (locationReassigned) {
      invalidateUserSession(
        staff._id,
        'SESSION_INVALIDATED',
        'Your session has been terminated because your account role or permissions were changed by an administrator. Please log in again.'
      );
    } else if (wasActive && !staff.isActive) {
      invalidateUserSession(staff._id, 'ACCOUNT_DEACTIVATED', 'Your account has been deactivated by an administrator.');
    }

    const obj = staff.toObject();
    delete obj.password;

    getIO().to('admin').emit('staffUpdated', { locationId, staffId: staff._id });
    return obj;
  }

  // Unassigns a staff member from this location. Rather than deleting the
  // account (which would orphan their booking history), demotes them back
  // to a plain 'user' — matching the invariant that every 'staff' account
  // must carry a locationId.
  async removeLocationStaff(locationId, staffId) {
    const staff = await User.findOne({ _id: staffId, role: 'staff', locationId });
    if (!staff) {
      const err = new Error('Staff member not found for this location.');
      err.statusCode = 404;
      throw err;
    }

    staff.role = 'user';
    staff.locationId = null;
    // This is a role change (staff -> user) just like updateUserRole above,
    // so it must invalidate any session already issued under the old
    // 'staff' role the same way — see the tokenVersion check in
    // auth.middleware.js.
    staff.tokenVersion = (staff.tokenVersion || 0) + 1;
    await staff.save();

    invalidateUserSession(
      staff._id,
      'SESSION_INVALIDATED',
      'Your session has been terminated because your account role or permissions were changed by an administrator. Please log in again.'
    );

    getIO().to('admin').emit('staffUpdated', { locationId, staffId: staff._id, removed: true });
    return { message: 'Staff member removed from this location.' };
  }
}

module.exports = new AdminService();