const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { slotValidator, locationValidator, staffCreateValidator } = require('../middleware/validation.middleware');

router.use(protect);
router.use(authorize('admin'));

// Dashboard & Revenue
router.get('/dashboard', adminController.getDashboard);
router.get('/revenue', adminController.getRevenue);

// User Management
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/toggle', adminController.toggleUserStatus);

// Slot Management
router.post('/slots', slotValidator, adminController.createSlot);
router.put('/slots/:id', adminController.updateSlot);
router.delete('/slots/:id', adminController.deleteSlot);
router.put('/slots/:id/pricing', adminController.updatePricing);

// Parking Location Management (multi-location support for Nearby Parking)
router.get('/locations', adminController.getLocations);
router.post('/locations', locationValidator, adminController.createLocation);
router.put('/locations/:id', adminController.updateLocation);
router.delete('/locations/:id', adminController.deleteLocation);
router.get('/locations/:id/detail', adminController.getLocationDetail);

// Per-location Staff Management (multi-location support)
router.get('/locations/:id/staff', adminController.getLocationStaff);
router.post('/locations/:id/staff', staffCreateValidator, adminController.addLocationStaff);
router.put('/locations/:id/staff/:staffId', adminController.updateLocationStaff);
router.delete('/locations/:id/staff/:staffId', adminController.removeLocationStaff);

module.exports = router;
