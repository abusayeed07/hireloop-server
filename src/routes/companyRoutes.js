// backend/src/routes/companyRoutes.js
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

// ✅ =============================================
// ✅ ADMIN ROUTES
// ✅ =============================================
const adminMiddleware = [requireAuth, requireActive, requireRole(['admin'])];

router.get('/admin/companies', adminMiddleware, companyController.getAllCompanies);
router.patch('/admin/companies/:id', adminMiddleware, companyController.updateCompanyStatus);
router.delete('/admin/companies/:id', adminMiddleware, companyController.deleteCompany);

// ✅ =============================================
// ✅ PUBLIC ROUTES - Show ALL companies (no filter)
// ✅ =============================================
router.get('/', companyController.getPublicCompanies);
router.get('/:id', companyController.getCompanyById);

module.exports = router;