const User = require('../models/User');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');
const Booking = require('../models/Booking');
const Revenue = require('../models/Revenue');
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

/**
 * AdminService - Admin dashboard and management operations
 */
class AdminService {
  // ─── Dashboard Stats ─────────────────────────────────────────────────────────
  async getDashboardStats() {
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

  // ─── User Management ──────────────────────────────────────────────────────────
  // `role` optionally narrows the list to one role ('admin' | 'staff' | 'user') —
  // powers the Manage Users page's User/Staff/Admin selector. `locationId`
  // additionally scopes to one parking location — for 'staff' that's a
  // direct match on their assigned locationId; regular 'user' accounts
  // aren't tied to a location directly, so they're scoped instead to users
  // who have made at least one booking at that location.
  async getAllUsers(page = 1, limit = 20, role, locationId) {
    const skip = (page - 1) * limit;
    // Only show accounts that actually completed OTP verification.
    // Records created by /register/initiate but never verified are
    // pending signups, not real users, and should not appear here.
    const filter = { isEmailVerified: true };
    if (role && ['admin', 'staff', 'user'].includes(role)) filter.role = role;

    if (locationId) {
      if (filter.role === 'staff') {
        filter.locationId = locationId;
      } else if (filter.role === 'user') {
        const bookedUserIds = await Booking.distinct('userId', { locationId });
        filter._id = { $in: bookedUserIds };
      }
      // Location scoping doesn't apply to admins (or when no role is
      // specified) — admin accounts aren't tied to a parking location.
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

    const user = await User.findByIdAndUpdate(
      userId,
      update,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
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
    if (data.isActive !== undefined) staff.isActive = !!data.isActive;

    if (data.newLocationId !== undefined && data.newLocationId) {
      const newLoc = await ParkingLocation.findById(data.newLocationId);
      if (!newLoc) {
        const err = new Error('Selected parking location was not found.');
        err.statusCode = 400;
        throw err;
      }
      staff.locationId = newLoc._id;
    }

    await staff.save();
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
    await staff.save();

    getIO().to('admin').emit('staffUpdated', { locationId, staffId: staff._id, removed: true });
    return { message: 'Staff member removed from this location.' };
  }
}

module.exports = new AdminService();