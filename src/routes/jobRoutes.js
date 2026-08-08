// backend/src/routes/jobRoutes.js
const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================
router.get('/', jobController.getJobs);

// ==========================================
// ✅ IMPORTANT: Specific routes MUST come before parameterized routes
// ==========================================

// ✅ Specific route: /my-jobs MUST come before /:id
router.get('/my-jobs', requireAuth, jobController.getMyJobs);

// ✅ Parameterized route: /:id comes AFTER specific routes
router.get('/:id', jobController.getJobById);

// ==========================================
// PROTECTED ROUTES (Authentication required)
// ==========================================
router.post('/', requireAuth, jobController.createJob);
router.put('/:id', requireAuth, jobController.updateJob);
router.delete('/:id', requireAuth, jobController.deleteJob);
router.put('/:id/status', requireAuth, jobController.toggleJobStatus);

// ✅ Recruiter requests re-review
router.post('/:id/re-review', requireAuth, jobController.requestReReview);

// ==========================================
// ADMIN ROUTES (Authentication + Admin role required)
// ==========================================

// Get ALL jobs for Admin dashboard (with optional filters)
router.get('/admin/jobs', requireAuth, requireRole(['admin']), jobController.getAdminJobs);

// Get Admin Stats for dashboard
router.get('/admin/stats', requireAuth, requireRole(['admin']), jobController.getAdminStats);

// Delete any job (Admin only)
router.delete('/admin/jobs/:id', requireAuth, requireRole(['admin']), jobController.adminDeleteJob);

// Admin approve/reject job routes
router.patch('/admin/jobs/:id/approve', requireAuth, requireRole(['admin']), jobController.adminApproveJob);
router.patch('/admin/jobs/:id/reject', requireAuth, requireRole(['admin']), jobController.adminRejectJob);

module.exports = router;