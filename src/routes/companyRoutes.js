const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { requireAuth, requireActive, requireRole } = require('../middleware/authMiddleware');

// ✅ Add route logging for debugging
router.use((req, res, next) => {
    console.log(`🛣️ [CompanyRouter] ${req.method} ${req.originalUrl}`);
    next();
});

// ✅ =============================================
// ✅ SPECIFIC ROUTES MUST GO FIRST
// ✅ =============================================
router.get('/my', requireAuth, requireActive, companyController.getMyCompany);

// =============================================
// ✅ CREATE COMPANY (Protected - Recruiter only)
// =============================================
router.post('/', requireAuth, requireActive, companyController.createCompany);

// =============================================
// ✅ UPDATE COMPANY (Protected - Recruiter only)
// =============================================
router.put('/:id', requireAuth, requireActive, companyController.updateCompany);

// ✅ =============================================
// ✅ REQUEST RE-REVIEW (Protected - Recruiter only)
// ✅ =============================================
router.post('/:id/request-re-review', requireAuth, requireActive, companyController.requestReReview);

// ✅ =============================================
// ✅ ADMIN ROUTES
// ✅ =============================================
const adminMiddleware = [requireAuth, requireActive, requireRole(['admin'])];

// Get all companies
router.get('/admin/companies', adminMiddleware, companyController.getAllCompanies);

// ✅ Get single company by ID (Admin only)
router.get('/admin/companies/:id', adminMiddleware, companyController.getAdminCompanyById);

// Get company stats
router.get('/admin/stats', adminMiddleware, companyController.getCompanyStats);

// Update company status
router.patch('/admin/companies/:id', adminMiddleware, companyController.updateCompanyStatus);

// Delete company
router.delete('/admin/companies/:id', adminMiddleware, companyController.deleteCompany);

// ✅ Send message to company
router.post('/admin/companies/:id/message', adminMiddleware, companyController.sendMessageToCompany);

// ✅ Mark message as read
router.patch('/admin/companies/:id/mark-read', adminMiddleware, companyController.markMessageAsRead);

// ✅ Get all messages
router.get('/admin/messages', adminMiddleware, companyController.getAllMessages);

// ✅ =============================================
// ✅ PUBLIC ROUTES
// ✅ =============================================

// ✅ NEW: Public Stats Route (No auth required)
router.get('/stats/public', companyController.getPublicCompanyStats);

// Show ALL approved companies (no filter)
router.get('/', companyController.getPublicCompanies);

// ⚠️ CRITICAL: The /:id route MUST come AFTER all specific routes
router.get('/:id', companyController.getCompanyById);

module.exports = router;