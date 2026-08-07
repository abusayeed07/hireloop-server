// backend/src/routes/billingRoutes.js
const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { requireAuth } = require('../middleware/authMiddleware');

// ✅ NEW: PUBLIC ROUTE for Stripe Success Callbacks (No cookie needed!)
router.post('/subscriptions/stripe-success', billingController.createSubscription);

// ✅ Subscription routes (Protected)
router.get('/subscription', requireAuth, billingController.getSubscription);
router.post('/subscriptions', requireAuth, billingController.createSubscription);
router.post('/upgrade', requireAuth, billingController.upgradeSubscription);
router.post('/cancel', requireAuth, billingController.cancelSubscription);

// ✅ Billing history
router.get('/history', requireAuth, billingController.getBillingHistory);

// ✅ Payment methods routes
router.get('/payment-methods', requireAuth, billingController.getPaymentMethods);
router.post('/payment-methods', requireAuth, billingController.addPaymentMethod);
router.delete('/payment-methods/:paymentMethodId', requireAuth, billingController.deletePaymentMethod);
router.put('/payment-methods/:paymentMethodId/default', requireAuth, billingController.setDefaultPaymentMethod);

// ==========================================
// ✅ ADMIN ROUTES (Appended below existing routes)
// ==========================================
const { requireRole } = require('../middleware/authMiddleware');

// Get all transactions for Admin Dashboard
router.get('/admin/transactions', requireAuth, requireRole(['admin']), billingController.getAdminTransactions);

// Get Admin Revenue Stats
router.get('/admin/stats', requireAuth, requireRole(['admin']), billingController.getAdminStats);

module.exports = router;