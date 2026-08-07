const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb'); 
const { getCollections } = require('../lib/dbUtils');
const { requireAuth } = require('../middleware/authMiddleware');

let stripe;
try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized successfully');
} catch (error) {
    console.error('❌ Failed to initialize Stripe:', error.message);
}

const PLAN_PRICE_ID = {
    'seeker_pro': 'price_1TqtFkRxtr6U9N3znjQM7cMk',
    'seeker_premium': 'price_1TqtGPRxtr6U9N3zAF36sDXF',
    'recruiter_growth': 'price_1TqtHTRxtr6U9N3zeqsfffJb',
    'recruiter_enterprise': 'price_1TqtHtRxtr6U9N3z6iBww92u',
};

// ✅ 1. Create Checkout Session
router.post('/create-checkout-session', async (req, res) => {
    try {
        console.log('📥 Checkout request received');
        console.log('📥 Body:', req.body);

        const { plan_id, email, success_url, cancel_url } = req.body;

        if (!plan_id || !email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Plan ID and email are required' 
            });
        }

        const priceId = PLAN_PRICE_ID[plan_id];
        if (!priceId) {
            return res.status(404).json({ 
                success: false, 
                error: 'Invalid plan ID. Please select a valid plan.' 
            });
        }

        if (!stripe) {
            return res.status(500).json({
                success: false,
                error: 'Payment service not configured'
            });
        }

        const session = await stripe.checkout.sessions.create({
            customer_email: email,
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: success_url || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancel_url || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing`,
            metadata: {
                planId: plan_id,
                userEmail: email,
            },
        });

        return res.status(200).json({
            success: true,
            sessionId: session.id,
            url: session.url,
        });

    } catch (error) {
        console.error('❌ Checkout session error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to create checkout session'
        });
    }
});

// ✅ 2. Verify payment & upgrade user instantly
router.post('/verify-payment-and-upgrade', requireAuth, async (req, res) => {
    try {
        const { session_id } = req.body;
        const userId = req.user?.id;

        if (!session_id) {
            return res.status(400).json({ error: 'Session ID is required' });
        }
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 1. Verify the session with Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id);

        // 2. Check if the payment is actually successful
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        // 3. Get the plan_id from the metadata
        const planId = session.metadata?.planId;
        if (!planId) {
            return res.status(400).json({ error: 'Plan ID not found in session' });
        }

        // 4. Update the user's plan in the database
        const { usersCollection, plansCollection, subscriptionCollection, billingHistoryCollection, adminLogsCollection } = getCollections(); // ✅ Added adminLogsCollection
        const plan = await plansCollection.findOne({ id: planId });
        
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        // ✅ Log the Action FIRST (Before full confirmation so we have access to user)
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        const userName = user?.name || 'Unknown User';
        const userEmail = user?.email || 'Unknown Email';
        
        await adminLogsCollection.insertOne({
            action: `User Purchased Plan via Stripe: ${userName} (${userEmail}) -> ${plan.name || planId}`,
            adminEmail: 'System Automation',
            targetUserId: userId,
            createdAt: new Date()
        });
        console.log(`✅ Admin Log added for purchase: ${userEmail}`);

        await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { plan: planId } }
        );

        // Create subscription record
        const existingSub = await subscriptionCollection.findOne({ userId: userId });
        const subscriptionData = {
            userId: userId,
            planId: planId,
            status: 'active',
            amount: plan.price || 0,
            stripeSubscriptionId: session.subscription,
            updatedAt: new Date()
        };

        if (existingSub) {
            await subscriptionCollection.updateOne(
                { userId: userId },
                { $set: subscriptionData }
            );
        } else {
            subscriptionData.createdAt = new Date();
            await subscriptionCollection.insertOne(subscriptionData);
        }

        // Record billing history
        await billingHistoryCollection.insertOne({
            userId: userId,
            plan: plan.name || planId,
            amount: plan.price || 0,
            transactionId: session.id,
            status: 'paid',
            date: new Date(),
            invoiceUrl: session.invoice_url || null,
            description: `Upgraded to ${plan.name || planId} plan`
        });

        console.log(`✅ Successfully upgraded user ${userId} to plan ${planId}`);

        res.json({
            success: true,
            message: 'Payment verified and plan upgraded successfully',
            plan: plan
        });

    } catch (error) {
        console.error('❌ Error verifying payment and upgrading:', error);
        res.status(500).json({ error: error.message || 'Failed to verify payment and upgrade' });
    }
});

// ✅ 3. Stripe Config
router.get('/config', (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        isConfigured: !!process.env.STRIPE_SECRET_KEY
    });
});

module.exports = router;