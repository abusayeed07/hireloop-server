// backend/src/routes/deleteAccountRoutes.js
const express = require('express');
const router = express.Router();
const deleteAccountController = require('../controllers/deleteAccountController');
const { requireAuth } = require('../middleware/authMiddleware');

// ✅ DELETE /api/delete-account - Uses authenticated user ID from session
router.delete('/delete-account', requireAuth, deleteAccountController.deleteAccount);

// ✅ DELETE /api/delete-account/:userId - Uses user ID from URL (also requires auth)
router.delete('/delete-account/:userId', requireAuth, (req, res, next) => {
    // Pass the userId from params to the controller
    // The controller will check both req.user.id and req.params.userId
    next();
}, deleteAccountController.deleteAccount);

module.exports = router;