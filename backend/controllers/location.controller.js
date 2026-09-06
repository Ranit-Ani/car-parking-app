const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');

// Hard ceiling for the "search by radius" feature — the frontend also
// clamps this client-side, but the API is the real source of truth so a
// crafted request can't ask for more than this.
const MAX_RADIUS_KM = 5;
const DEFAULT_RADIUS_KM = 2;

/**
 * LocationController - Nearby Parking search + location browsing for users.
 */
class LocationController {
  // GET /api/locations - list every active parking location (used for
  // simple pickers / fallback when geolocation isn't available).
  async list(req, res, next) {
    try {
      const locations = await ParkingLocation.find({ isActive: true }).sort({ name: 1 });
      res.json({ success: true, count: locations.length, data: locations });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/locations/nearby?lat=&lng=&radius=&type=
  // Two search modes share this one endpoint:
  //   1. "Choose distance/radius" - lat/lng is the user's current GPS fix.
  //   2. "Search a specific location" - lat/lng is wherever the frontend's
  //      place/address/landmark search (geocoding) resolved to.
  // Either way we return every active ParkingLocation within `radius` km
  // (capped at MAX_RADIUS_KM), nearest first, with live slot availability.
  async nearby(req, res, next) {
    try {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const { type } = req.query;

      if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ success: false, message: 'Valid lat and lng query params are required.' });
      }

      let radiusKm = parseFloat(req.query.radius);
      if (Number.isNaN(radiusKm) || radiusKm <= 0) radiusKm = DEFAULT_RADIUS_KM;
      radiusKm = Math.min(radiusKm, MAX_RADIUS_KM);

      const locations = await ParkingLocation.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            distanceField: 'distanceMeters',
            maxDistance: radiusKm * 1000,
            spherical: true,
            query: { isActive: true },
          },
        },
        { $sort: { distanceMeters: 1 } },
      ]);

      const locationIds = locations.map((l) => l._id);
      const slotFilter = { locationId: { $in: locationIds }, isActive: true };
      if (type) slotFilter.slotType = type;

      const slotStats = await ParkingSlot.aggregate([
        { $match: slotFilter },
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

      const data = locations.map((loc) => {
        const stats = statsById.get(loc._id.toString());
        return {
          _id: loc._id,
          name: loc.name,
          address: loc.address,
          description: loc.description,
          amenities: loc.amenities || [],
          latitude: loc.geo.coordinates[1],
          longitude: loc.geo.coordinates[0],
          distanceKm: Math.round((loc.distanceMeters / 1000) * 100) / 100,
          totalSlots: stats ? stats.totalSlots : 0,
          availableSlots: stats ? stats.availableSlots : 0,
          minRate: stats ? stats.minRate : null,
          maxRate: stats ? stats.maxRate : null,
        };
      });

      res.json({
        success: true,
        count: data.length,
        radiusKm,
        center: { lat, lng },
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/locations/:id - a single location plus its currently
  // available slots, so the user can pick one to book.
  async getById(req, res, next) {
    try {
      const location = await ParkingLocation.findOne({ _id: req.params.id, isActive: true });
      if (!location) {
        return res.status(404).json({ success: false, message: 'Parking location not found.' });
      }

      const slots = await ParkingSlot.find({ locationId: location._id, isActive: true }).sort({ slotNumber: 1 });

      res.json({ success: true, data: { location, slots } });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LocationController();
