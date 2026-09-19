const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Verify JWT Token ──────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Not authorized. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, code: 'USER_NOT_FOUND', message: 'User no longer exists.' });
    }

    if (user.isDeleted) {
      return res.status(401).json({
        success: false,
        code: 'ACCOUNT_DELETED',
        message: 'This account has been deleted.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Your account has been deactivated.',
      });
    }

    // ─── Session invalidation on role/permission change ───────────────────────
    // `tokenVersion` is baked into the token at issue time (see
    // User.generateJWT) and bumped on the user's DB record whenever an
    // admin changes their role (see AdminService.updateUserRole /
    // removeLocationStaff). If they don't match, this token was issued
    // under a permission set that no longer applies — reject it outright
    // rather than letting the request through with a stale role, even
    // though the token itself is still validly signed and unexpired.
    const tokenVersion = decoded.tokenVersion || 0;
    const currentVersion = user.tokenVersion || 0;
    if (tokenVersion !== currentVersion) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_INVALIDATED',
        message: 'Your session has been terminated because your account role or permissions were changed by an administrator. Please log in again.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Invalid token.' });
  }
};

// ─── Role-Based Access Control ─────────────────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized for this resource.`,
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
