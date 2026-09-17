const AppError = require('../utils/AppError');

// ─── EmailJS (non-browser / Private Key mode) ───────────────────────────────
// The person enabled "Allow EmailJS API for non-browser applications" and
// chose Private Key auth in their EmailJS dashboard. That mode is meant for
// server-to-server calls — the private key must never reach the browser
// bundle, so the send happens here instead of client-side. EmailJS's REST
// endpoint accepts { service_id, template_id, user_id (= public key),
// accessToken (= private key), template_params }.
const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';
const {
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY,
  EMAILJS_PRIVATE_KEY,
  SUPPORT_EMAIL,
} = process.env;

const isConfigured = () => !!(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY && EMAILJS_PRIVATE_KEY);

// ─── POST /api/support/contact ───────────────────────────────────────────────
// Public (unauthenticated) — the Landing page is public, so there's no
// logged-in user to attach this to.
exports.sendContactMessage = async (req, res, next) => {
  try {
    if (!isConfigured()) {
      return next(new AppError('Contact form is not configured yet. Please try Email Support instead.', 503));
    }

    const { name, email, message } = req.body;

    const emailjsRes = await fetch(EMAILJS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: {
          from_name: name,
          from_email: email,
          message,
          to_email: SUPPORT_EMAIL || 'support@carparkingnetwork.com',
        },
      }),
    });

    if (!emailjsRes.ok) {
      const detail = await emailjsRes.text().catch(() => '');
      console.error('EmailJS send failed:', emailjsRes.status, detail);
      return next(new AppError('Could not send your message right now. Please try Email Support instead.', 502));
    }

    res.status(200).json({ success: true, message: "Message sent! We'll get back to you soon." });
  } catch (err) {
    next(err);
  }
};
