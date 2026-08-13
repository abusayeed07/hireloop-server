const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
// ✅ FIXED: Import requireActive
const { requireAuth, requireActive, requireRole } = require('../middleware/authMiddleware');

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================
router.get('/', jobController.getJobs);

// ==========================================
// ✅ IMPORTANT: Specific routes MUST come before parameterized routes
// ==========================================

// ✅ Specific route: /my-jobs MUST come before /:id
// ✅ Added requireActive to ensure suspended users can't see their own jobs
router.get('/my-jobs', requireAuth, requireActive, jobController.getMyJobs);

// ✅ Parameterized route: /:id comes AFTER specific routes
router.get('/:id', jobController.getJobById);

// ==========================================
// PROTECTED ROUTES (Authentication required)
// ==========================================
// ✅ Added requireActive to all protected recruiter routes
router.post('/', requireAuth, requireActive, jobController.createJob);
router.put('/:id', requireAuth, requireActive, jobController.updateJob);
router.delete('/:id', requireAuth, requireActive, jobController.deleteJob);
router.put('/:id/status', requireAuth, requireActive, jobController.toggleJobStatus);

// ✅ Recruiter requests re-review
router.post('/:id/re-review', requireAuth, requireActive, jobController.requestReReview);

// ==========================================
// ADMIN ROUTES (Authentication + Admin role required)
// ==========================================
// ✅ Added requireActive to all admin routes

// Get ALL jobs for Admin dashboard (with optional filters)
router.get('/admin/jobs', requireAuth, requireActive, requireRole(['admin']), jobController.getAdminJobs);

// ✅ Get a SINGLE job by ID for Admin details page
router.get('/admin/jobs/:id', requireAuth, requireActive, requireRole(['admin']), jobController.getAdminJobById);

// Get Admin Stats for dashboard
router.get('/admin/stats', requireAuth, requireActive, requireRole(['admin']), jobController.getAdminStats);

// Delete any job (Admin only)
router.delete('/admin/jobs/:id', requireAuth, requireActive, requireRole(['admin']), jobController.adminDeleteJob);

// Admin approve/reject job routes
router.patch('/admin/jobs/:id/approve', requireAuth, requireActive, requireRole(['admin']), jobController.adminApproveJob);
router.patch('/admin/jobs/:id/reject', requireAuth, requireActive, requireRole(['admin']), jobController.adminRejectJob);

module.exports = router;