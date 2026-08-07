// backend/src/routes/savedJobRoutes.js
const express = require('express');
const router = express.Router();
const savedJobController = require('../controllers/savedJobController');
const { authMiddleware, requireAuth } = require('../middleware/authMiddleware');

// 🔓 PUBLIC ROUTES (No auth required)
router.get('/check/:jobId', savedJobController.checkSavedStatus);

// 🔒 PROTECTED ROUTES
router.get('/', authMiddleware, savedJobController.getSavedJobs);
router.get('/ids', authMiddleware, savedJobController.getSavedJobIds);
router.post('/', requireAuth, savedJobController.saveJob);
router.delete('/:jobId', requireAuth, savedJobController.unsaveJob);

module.exports = router;