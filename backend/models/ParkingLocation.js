const mongoose = require('mongoose');

/**
 * ParkingLocation - a physical parking site (a campus block, a lot, an
 * off-campus facility, etc). Introduced to support multiple parking
 * locations: each ParkingSlot now optionally belongs to one of these via
 * `locationId`, and this model carries the geo-coordinates that power
 * "Nearby Parking" search and in-app navigation.
 */
const ParkingLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // GeoJSON Point — coordinates are [longitude, latitude] (Mongo/GeoJSON
    // order, NOT [lat, lng]).
    geo: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: [true, 'Coordinates are required'],
        validate: {
          validator: (v) =>
            Array.isArray(v) &&
            v.length === 2 &&
            Number.isFinite(v[0]) &&
            Number.isFinite(v[1]) &&
            v[0] >= -180 &&
            v[0] <= 180 &&
            v[1] >= -90 &&
            v[1] <= 90,
          message: 'Coordinates must be [longitude, latitude] within valid ranges',
        },
      },
    },
    amenities: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
// Powers $geoNear / $near queries for "search by radius" and "search near a
// specific place".
ParkingLocationSchema.index({ geo: '2dsphere' });
ParkingLocationSchema.index({ isActive: 1 });

// ─── Convenience virtuals ──────────────────────────────────────────────────────
ParkingLocationSchema.virtual('latitude').get(function () {
  return this.geo && this.geo.coordinates ? this.geo.coordinates[1] : undefined;
});
ParkingLocationSchema.virtual('longitude').get(function () {
  return this.geo && this.geo.coordinates ? this.geo.coordinates[0] : undefined;
});

ParkingLocationSchema.set('toJSON', { virtuals: true });
ParkingLocationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ParkingLocation', ParkingLocationSchema);
