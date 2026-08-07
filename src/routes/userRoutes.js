// backend/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireActive, requireRole } = require('../middleware/authMiddleware');

// ✅ Add route logging for debugging
router.use((req, res, next) => {
    console.log(`🛣️ [UserRouter] ${req.method} ${req.originalUrl}`);
    next();
});

// ✅ =============================================
// ✅ ADMIN ROUTES - MUST COME FIRST!
// ✅ =============================================
router.get(
    '/admin/stats', 
    requireAuth, 
    requireActive,
    requireRole(['admin']), 
    userController.getUserStats
);

router.get(
    '/admin/users', 
    requireAuth, 
    requireActive,
    requireRole(['admin']), 
    userController.getAllUsers
);

router.get(
    '/admin/users/:id', 
    requireAuth, 
    requireActive,
    requireRole(['admin']), 
    userController.getUserById
);

router.patch(
    '/admin/users/:id', 
    requireAuth, 
    requireActive,
    requireRole(['admin']), 
    userController.updateUser
);

router.delete(
    '/admin/users/:id', 
    requireAuth, 
    requireActive,
    requireRole(['admin']), 
    userController.deleteUser
);

// ✅ =============================================
// ✅ LOG USER SIGNUP - No auth required (called after signup)
// ✅ =============================================
router.post('/log-signup', (req, res, next) => {
    console.log('🔍🔍🔍 /log-signup route hit!');
    console.log('📝 Request body:', req.body);
    next();
}, userController.logUserSignup);

// ✅ =============================================
// ✅ PROTECTED ROUTES (require active user)
// ✅ =============================================
router.get(
    '/profile', 
    requireAuth, 
    requireActive,
    userController.getProfile
);

// ✅ =============================================
// ✅ PUBLIC ROUTES - MUST COME LAST!
// ✅ =============================================
router.get('/', userController.getPublicUsers);

module.exports = router;