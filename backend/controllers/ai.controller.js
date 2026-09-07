const LocalAIService = require('../services/LocalAIService');

// POST /api/ai/chat
exports.chat = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    const result = await LocalAIService.chat({
      // locationId (multi-location support) is only meaningful for staff —
      // it's how LocalAIService locks their answers to their own assigned
      // site, the same field every other staff-facing route already trusts.
      user: { id: req.user._id, name: req.user.name, role: req.user.role, locationId: req.user.locationId || null },
      message: message.trim(),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/ai/scan-plate
exports.scanPlate = async (req, res, next) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'imageBase64 is required.' });
    }
    const result = await LocalAIService.scanPlate();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
