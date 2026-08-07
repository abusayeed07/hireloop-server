// backend/src/routes/applicationRoutes.js
const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { requireAuth, requireActive, requireRole } = require('../middleware/authMiddleware');

// ✅ =============================================
// ✅ ADMIN ROUTES - MUST COME FIRST!
// ✅ =============================================

// Get ALL applications (Admin only)
router.get(
    '/admin/applications',
    requireAuth,
    requireActive,
    requireRole(['admin']),
    applicationController.getAllApplicationsAdmin
);

// Get application stats (Admin only)
router.get(
    '/admin/applications/stats',
    requireAuth,
    requireActive,
    requireRole(['admin']),
    applicationController.getApplicationStats
);

// Get application by ID (Admin only)
router.get(
    '/admin/applications/:id',
    requireAuth,
    requireActive,
    requireRole(['admin']),
    applicationController.getApplicationById
);

// Update application status (Admin only)
router.patch(
    '/admin/applications/:id/status',
    requireAuth,
    requireActive,
    requireRole(['admin']),
    applicationController.updateApplicationStatus
);

// Get applications by job ID (Admin only)
router.get(
    '/admin/applications/job/:jobId',
    requireAuth,
    requireActive,
    requireRole(['admin']),
    applicationController.getApplicationsByJob
);

// ✅ =============================================
// ✅ PROTECTED ROUTES (require active user)
// ✅ =============================================

// Get user's applications (authenticated user)
router.get(
    '/',
    requireAuth,
    requireActive,
    applicationController.getAllApplications
);

// Create new application
router.post(
    '/',
    requireAuth,
    requireActive,
    applicationController.createApplication
);

module.exports = router;