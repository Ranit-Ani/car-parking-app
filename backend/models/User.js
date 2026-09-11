const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// A user can save multiple vehicles to their account and pick between them
// when creating a booking, instead of typing the details in every time.
const VehicleSchema = new mongoose.Schema(
  {
    category: {
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
    nickname: {
      type: String,
      trim: true,
      maxlength: 40,
      default: null,
    },
  },
  { timestamps: true }
);

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'staff', 'user'],
      default: 'user',
    },

    // Multi-location staff support: a 'staff' user is always tied to
    // exactly one ParkingLocation and may only see/manage bookings,
    // slots, and vehicles for that location (enforced in the service
    // layer — see AdminService.updateUserRole / addLocationStaff and
    // StaffService's location-scoped queries). Null for admin/user
    // accounts, and for legacy staff created before this feature.
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      default: null,
    },

    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    profilePhoto: { type: String, default: null },

    // Bumped every time an admin changes this user's role/location (see
    // AdminService.updateUserRole / removeLocationStaff). The value at the
    // time a JWT was issued is baked into that token's payload; `protect`
    // rejects any token whose tokenVersion doesn't match the current value
    // here. This is what forces an already-logged-in user's session to die
    // the moment their permissions change, instead of just on next login.
    // Left selectable by default (unlike `password`) because every place
    // that builds a JWT or checks this value needs it present on whatever
    // user doc it already has in hand, without every single query in the
    // codebase remembering a `+tokenVersion` select (login, register,
    // email-change, admin listings, etc. all fetch users differently).
    // It's kept out of client-facing JSON instead via the toJSON/toObject
    // transform below, the same way `__v` is hidden.
    tokenVersion: { type: Number, default: 0 },

    // Saved vehicles for this account (Rule 3: users can save multiple vehicles).
    vehicles: { type: [VehicleSchema], default: [] },

    // OTP — stored as plain fields, no nested enum validation that could fail silently
    otpCode:      { type: String,  default: null },
    otpExpiresAt: { type: Date,    default: null },
    otpPurpose:   { type: String,  default: null },  // 'register' | 'email-change'
    otpNewEmail:  { type: String,  default: null },
  },
  {
    timestamps: true,
    // Every controller in this codebase builds its own response shape by
    // hand (see auth.controller's sendToken/getMe), so tokenVersion never
    // gets copied into a response on purpose — but any spot that ever
    // does `res.json(userDoc)` or `res.json({ data: someUserDoc })`
    // directly (e.g. the admin user-management endpoints, which return
    // raw Mongoose docs) would otherwise leak this internal bookkeeping
    // counter. Stripping it here means that's true everywhere, always,
    // rather than depending on every future response staying hand-built.
    toJSON: { transform: (_doc, ret) => { delete ret.tokenVersion; return ret; } },
    toObject: { transform: (_doc, ret) => { delete ret.tokenVersion; return ret; } },
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

UserSchema.methods.generateJWT = function () {
  return jwt.sign(
    {
      id: this._id,
      role: this.role,
      name: this.name,
      locationId: this.locationId || null,
      // Baked in at issue time so `protect` can detect role/permission
      // changes made *after* this token was handed out (see tokenVersion
      // field above).
      tokenVersion: this.tokenVersion || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Powers "staff assigned to this location" lookups.
UserSchema.index({ role: 1, locationId: 1 });

UserSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

module.exports = mongoose.model('User', UserSchema);
