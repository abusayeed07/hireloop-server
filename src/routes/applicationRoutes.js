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
// ✅ SEEKER ROUTES - Get my applications
// ✅ =============================================

// Get my applications (Seeker)
router.get(
    '/my',
    requireAuth,
    requireActive,
    applicationController.getMyApplications
);

// ✅ =============================================
// ✅ RECRUITER ROUTES
// ✅ =============================================

// Get all applications for recruiter's company
router.get(
    '/recruiter',
    requireAuth,
    requireActive,
    applicationController.getRecruiterApplications
);

// Get application stats for recruiter
router.get(
    '/recruiter/stats',
    requireAuth,
    requireActive,
    applicationController.getRecruiterStats
);

// ✅ Get single application by ID (Recruiter) - ADD THIS ROUTE
router.get(
    '/recruiter/:id',
    requireAuth,
    requireActive,
    applicationController.getApplicationByIdRecruiter
);

// ✅ =============================================
// ✅ UPDATE APPLICATION STATUS (Recruiter)
// ✅ =============================================

// Update application status (Recruiter) - Checks COMPANY ownership
router.patch(
    '/:id/status',
    requireAuth,
    requireActive,
    applicationController.updateApplicationStatusRecruiter
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