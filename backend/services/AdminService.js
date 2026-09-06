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
  async getRevenueReport(startDate, endDate) {
    const [summary, daily] = await Promise.all([
      Booking.getRevenue(startDate, endDate),
      Booking.getDailyRevenue(30),
    ]);
    return { summary, daily };
  }

  // ─── User Management ──────────────────────────────────────────────────────────
  async getAllUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    // Only show accounts that actually completed OTP verification.
    // Records created by /register/initiate but never verified are
    // pending signups, not real users, and should not appear here.
    const filter = { isEmailVerified: true };
    const [users, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    return { users, total, page, pages: Math.ceil(total / limit) };
  }

  async updateUserRole(userId, role) {
    const validRoles = ['admin', 'staff', 'user'];
    if (!validRoles.includes(role)) {
      const err = new Error('Invalid role specified.');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    getIO().to('admin').emit('userUpdated', { userId: user._id, role: user.role });

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
    const [locations, counts] = await Promise.all([
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
    ]);

    const byId = new Map(counts.filter((c) => c._id).map((c) => [c._id.toString(), c]));

    return locations.map((loc) => {
      const obj = loc.toObject();
      const c = byId.get(loc._id.toString());
      obj.totalSlots = c ? c.totalSlots : 0;
      obj.availableSlots = c ? c.availableSlots : 0;
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

    const location = await ParkingLocation.findByIdAndDelete(locationId);
    if (!location) {
      const err = new Error('Parking location not found.');
      err.statusCode = 404;
      throw err;
    }

    getIO().emit('locationDeleted', { locationId });
    return { message: 'Parking location deleted successfully.' };
  }
}

module.exports = new AdminService();