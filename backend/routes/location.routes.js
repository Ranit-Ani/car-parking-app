const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const { protect } = require('../middleware/auth.middleware');

// All location routes require a logged-in user (same as the rest of the app).
router.use(protect);

router.get('/nearby', locationController.nearby); // Nearby Parking search (radius or geocoded point)
router.get('/', locationController.list);          // All active locations
router.get('/:id', locationController.getById);    // One location + its slots

module.exports = router;
