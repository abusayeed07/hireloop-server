// backend/src/routes/applicationRoutes.js
const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, applicationController.getAllApplications);
router.post('/', requireAuth, applicationController.createApplication);

module.exports = router;