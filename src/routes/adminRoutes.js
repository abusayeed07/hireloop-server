const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// All routes below require Admin authentication
const adminCheck = [requireAuth, requireRole(['admin'])];

// ✅ 1. Get Admin Activity Log
router.get('/admin/activity-log', adminCheck, adminController.getAdminLogs);

// ✅ 2. Invite New Admin
router.post('/admin/invite', adminCheck, adminController.inviteAdmin);

// ✅ 3. Get Platform Settings
router.get('/admin/settings', adminCheck, adminController.getSettings);

// ✅ 4. Update Platform Settings
router.put('/admin/settings', adminCheck, adminController.updateSettings);

module.exports = router;