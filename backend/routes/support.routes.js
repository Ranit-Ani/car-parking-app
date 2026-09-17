const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const support = require('../controllers/support.controller');
const { contactValidator } = require('../middleware/validation.middleware');

// Separate, tighter limit than the general /api/ limiter — this endpoint is
// public/unauthenticated (Landing page has no logged-in user) and triggers
// an outbound EmailJS send, so it's worth capping harder against spam.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: { success: false, message: 'Too many messages sent. Please try again later.' },
});

router.post('/contact', contactLimiter, contactValidator, support.sendContactMessage);

module.exports = router;
