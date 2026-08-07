// backend/src/routes/jobRoutes.js
const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { requireAuth } = require('../middleware/authMiddleware');

// ✅ Public routes (No authentication required)
router.get('/', jobController.getJobs);
router.get('/my-jobs', requireAuth, jobController.getMyJobs);
router.get('/:id', jobController.getJobById);

// ✅ Protected routes
router.post('/', requireAuth, jobController.createJob);
router.put('/:id', requireAuth, jobController.updateJob);
router.delete('/:id', requireAuth, jobController.deleteJob);
// Add this route
router.put('/:id/status', requireAuth, jobController.toggleJobStatus);


// ==========================================
// ✅ ADMIN ROUTES (Appended below existing routes)
// ==========================================
// Note: requireRole must be imported at the top of this file
const { requireRole } = require('../middleware/authMiddleware');

// Get ALL jobs for Admin dashboard (with optional filters)
router.get('/admin/jobs', requireAuth, requireRole(['admin']), jobController.getAdminJobs);

// Get Admin Stats for dashboard
router.get('/admin/stats', requireAuth, requireRole(['admin']), jobController.getAdminStats);

// Delete any job (Admin only)
router.delete('/admin/jobs/:id', requireAuth, requireRole(['admin']), jobController.adminDeleteJob);

module.exports = router;