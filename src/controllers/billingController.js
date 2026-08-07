const { ObjectId } = require('mongodb');
const { getCollections } = require('../lib/dbUtils');

// ============================================
// SUBSCRIPTION & PLAN LOGIC
// ============================================

exports.getSubscription = async (req, res) => {
    try {
        const { plansCollection, usersCollection, subscriptionCollection } = getCollections();
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        let userPlanId = user?.plan || 'seeker_free';

        const subscriptionDoc = await subscriptionCollection.findOne({ userId: userId });

        if (subscriptionDoc && subscriptionDoc.planId && subscriptionDoc.status === 'active') {
            userPlanId = subscriptionDoc.planId;
        }

        const planDetails = await plansCollection.findOne({ id: userPlanId });

        if (!planDetails) {
            return res.json({
                planId: 'seeker_free',
                planName: 'Free',
                planTier: 'free',
                description: 'Basic plan with essential features',
                features: [{ included: true, text: 'Browse jobs' }],
                status: 'active',
                amount: 0,
                userPlan: 'free'
            });
        }

        let status = 'active';
        if (subscriptionDoc?.status === 'cancelled' || subscriptionDoc?.status === 'canceled') {
            status = 'cancelled';
        }

        const response = {
            planId: planDetails.id,
            planName: planDetails.name,
            planTier: planDetails.tier,
            description: planDetails.description,
            features: planDetails.features || [],
            status: status,
            amount: planDetails.price || 0,
            period: planDetails.period || '/month',
            maxActiveJobs: planDetails.maxActiveJobs || 0,
            maxApplicationsPerMonth: planDetails.maxApplicationsPerMonth || 0,
            currentPeriodEnd: subscriptionDoc?.currentPeriodEnd || null
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
};

exports.createSubscription = async (req, res) => {
    try {
        const { subscriptionCollection, usersCollection, plansCollection, billingHistoryCollection, adminLogsCollection } = getCollections(); // Added adminLogsCollection
        const data = req.body;
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const subsInfo = {
            ...data,
            userId: userId,
            status: 'active',
            createdAt: new Date()
        };

        const existingSub = await subscriptionCollection.findOne({ userId: userId });
        let result;

        if (existingSub) {
            result = await subscriptionCollection.updateOne(
                { userId: userId },
                { $set: subsInfo }
            );
        } else {
            result = await subscriptionCollection.insertOne(subsInfo);
        }

        await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { plan: data.planId } }
        );

        const plan = await plansCollection.findOne({ id: data.planId });
        await billingHistoryCollection.insertOne({
            userId: userId,
            plan: plan?.name || data.planId,
            amount: parseFloat(plan?.price) || 0,
            transactionId: `SUB-${Date.now()}`,
            status: 'paid',
            date: new Date(),
            description: `Subscribed to ${plan?.name || data.planId} plan`
        });

        // ✅ Log the Action
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        const userName = user?.name || 'Unknown User';
        const userEmail = user?.email || 'Unknown Email';
        await adminLogsCollection.insertOne({
            action: `User Purchased Plan: ${userName} (${userEmail}) -> ${plan?.name || data.planId}`,
            adminEmail: 'System Automation',
            targetUserId: userId,
            createdAt: new Date()
        });

        res.send({
            success: true,
            subscription: result,
            message: 'Subscription created successfully'
        });
    } catch (error) {
        console.error('Subscription creation error:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
};

exports.upgradeSubscription = async (req, res) => {
    try {
        const { subscriptionCollection, usersCollection, plansCollection, billingHistoryCollection, adminLogsCollection } = getCollections(); // Added adminLogsCollection
        const { planId } = req.body;
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!planId) {
            return res.status(400).json({ error: 'Plan ID is required' });
        }

        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const plan = await plansCollection.findOne({ id: planId });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        const subscriptionData = {
            userId: userId,
            planId: planId,
            status: 'active',
            amount: parseFloat(plan.price) || 0,
            updatedAt: new Date()
        };

        const existingSub = await subscriptionCollection.findOne({ userId: userId });
        let result;

        if (existingSub) {
            result = await subscriptionCollection.updateOne(
                { userId: userId },
                { $set: subscriptionData }
            );
        } else {
            subscriptionData.createdAt = new Date();
            result = await subscriptionCollection.insertOne(subscriptionData);
        }

        await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { plan: planId } }
        );

        await billingHistoryCollection.insertOne({
            userId: userId,
            plan: plan.name || planId,
            amount: parseFloat(plan.price) || 0,
            transactionId: `UPG-${Date.now()}`,
            status: 'paid',
            date: new Date(),
            description: `Upgraded to ${plan.name} plan`
        });

        // ✅ Log the Action
        const userName = user?.name || 'Unknown User';
        const userEmail = user?.email || 'Unknown Email';
        await adminLogsCollection.insertOne({
            action: `User Upgraded Plan: ${userName} (${userEmail}) -> ${plan.name}`,
            adminEmail: 'System Automation',
            targetUserId: userId,
            createdAt: new Date()
        });

        res.json({
            success: true,
            message: 'Subscription upgraded successfully',
            subscription: subscriptionData
        });
    } catch (error) {
        console.error('Upgrade error:', error);
        res.status(500).json({ error: 'Failed to upgrade subscription' });
    }
};

exports.cancelSubscription = async (req, res) => {
    try {
        const { subscriptionCollection, usersCollection, billingHistoryCollection, adminLogsCollection } = getCollections(); // Added adminLogsCollection
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        let currentSub = await subscriptionCollection.findOne({ userId: userId });
        let userPlan = null;
        let isPaidPlan = false;
        
        if (!currentSub) {
            const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
            userPlan = user?.plan;
            if (userPlan && userPlan !== 'seeker_free' && userPlan !== 'recruiter_free') {
                isPaidPlan = true;
            }
        } else {
            isPaidPlan = currentSub.planId && 
                currentSub.planId !== 'seeker_free' && 
                currentSub.planId !== 'recruiter_free';
        }

        if (!isPaidPlan) {
            return res.status(404).json({ 
                success: false, 
                error: 'No active paid subscription found to cancel.' 
            });
        }

        const planIdToCancel = currentSub?.planId || userPlan;

        if (currentSub) {
            await subscriptionCollection.updateOne(
                { userId: userId },
                {
                    $set: {
                        status: 'cancelled',
                        planId: 'seeker_free',
                        amount: 0,
                        cancelAtPeriodEnd: true,
                        updatedAt: new Date()
                    }
                }
            );
        }

        await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { plan: 'free' } }
        );

        await billingHistoryCollection.insertOne({
            userId: userId,
            plan: planIdToCancel || 'Unknown',
            amount: 0,
            transactionId: `CAN-${Date.now()}`,
            status: 'cancelled',
            date: new Date(),
            description: `Subscription cancelled (was ${planIdToCancel})`
        });

        const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });

        // ✅ Log the Action
        const userName = updatedUser?.name || 'Unknown User';
        const userEmail = updatedUser?.email || 'Unknown Email';
        await adminLogsCollection.insertOne({
            action: `User Cancelled Plan: ${userName} (${userEmail})`,
            adminEmail: 'System Automation',
            targetUserId: userId,
            createdAt: new Date()
        });

        return res.status(200).json({
            success: true,
            message: 'Subscription cancelled successfully',
            userPlan: updatedUser?.plan || 'free'
        });
    } catch (error) {
        console.error('Cancel error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to cancel subscription' });
    }
};

exports.getBillingHistory = async (req, res) => {
    try {
        const { billingHistoryCollection } = getCollections();
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        let history = await billingHistoryCollection
            .find({ userId: userId })
            .sort({ date: -1 })
            .limit(50)
            .toArray();

        if (!history || history.length === 0) return res.json([]);

        const formattedHistory = history.map((item) => ({
            id: item._id?.toString(),
            date: item.date || new Date(),
            plan: item.plan || 'Unknown',
            amount: item.amount || 0,
            transactionId: item.transactionId || `TX-${Date.now()}`,
            status: item.status || 'paid',
            invoiceUrl: item.invoiceUrl || null,
            description: item.description || ''
        }));

        res.json(formattedHistory);
    } catch (error) {
        console.error('Error fetching billing history:', error);
        res.status(500).json({ error: 'Failed to fetch billing history' });
    }
};

// ============================================
// PAYMENT METHOD LOGIC
// ============================================

exports.getPaymentMethods = async (req, res) => {
    try {
        const { paymentMethodsCollection } = getCollections();
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const paymentMethods = await paymentMethodsCollection
            .find({ userId: userId })
            .sort({ createdAt: -1 })
            .toArray();

        res.json(paymentMethods || []);
    } catch (error) {
        console.error('❌ Error fetching payment methods:', error);
        res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
};

exports.addPaymentMethod = async (req, res) => {
    try {
        const { paymentMethodsCollection } = getCollections();
        const userId = req.user?.id;
        const paymentData = req.body;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const requiredFields = ['cardNumber', 'expiryMonth', 'expiryYear', 'cardholderName'];
        for (const field of requiredFields) {
            if (!paymentData[field]) {
                return res.status(400).json({ 
                    success: false, 
                    error: `${field} is required` 
                });
            }
        }

        const first4 = paymentData.cardNumber.slice(0, 4);
        const last4 = paymentData.cardNumber.slice(-4);
        
        const firstDigit = paymentData.cardNumber.charAt(0);
        let brand = 'Unknown';
        if (firstDigit === '4') brand = 'VISA';
        else if (firstDigit === '5') brand = 'MasterCard';
        else if (firstDigit === '3') brand = 'American Express';
        else if (firstDigit === '6') brand = 'Discover';
        else if (firstDigit === '2' || firstDigit === '7') brand = 'MasterCard';
        else if (firstDigit === '1') brand = 'VISA';
        
        if (last4 === '4242') brand = 'VISA';

        const newPaymentMethod = {
            userId: userId,
            brand: paymentData.brand || brand,
            first4: first4,
            last4: last4,
            expiryMonth: paymentData.expiryMonth,
            expiryYear: paymentData.expiryYear,
            cardholderName: paymentData.cardholderName,
            isDefault: paymentData.isDefault || false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (newPaymentMethod.isDefault) {
            await paymentMethodsCollection.updateMany(
                { userId: userId },
                { $set: { isDefault: false } }
            );
        }

        const result = await paymentMethodsCollection.insertOne(newPaymentMethod);
        
        res.status(201).json({
            success: true,
            message: 'Payment method added successfully',
            paymentMethodId: result.insertedId,
            paymentMethod: {
                ...newPaymentMethod,
                _id: result.insertedId
            }
        });
    } catch (error) {
        console.error('❌ Error adding payment method:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to add payment method' 
        });
    }
};

exports.deletePaymentMethod = async (req, res) => {
    try {
        const { paymentMethodsCollection } = getCollections();
        const userId = req.user?.id;
        const { paymentMethodId } = req.params;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!ObjectId.isValid(paymentMethodId)) {
            return res.status(400).json({ error: 'Invalid payment method ID' });
        }

        const result = await paymentMethodsCollection.deleteOne({
            _id: new ObjectId(paymentMethodId),
            userId: userId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Payment method not found' 
            });
        }

        res.json({
            success: true,
            message: 'Payment method deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting payment method:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to delete payment method' 
        });
    }
};

exports.setDefaultPaymentMethod = async (req, res) => {
    try {
        const { paymentMethodsCollection } = getCollections();
        const userId = req.user?.id;
        const { paymentMethodId } = req.params;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!ObjectId.isValid(paymentMethodId)) {
            return res.status(400).json({ error: 'Invalid payment method ID' });
        }

        await paymentMethodsCollection.updateMany(
            { userId: userId },
            { $set: { isDefault: false } }
        );

        const result = await paymentMethodsCollection.updateOne(
            { 
                _id: new ObjectId(paymentMethodId),
                userId: userId 
            },
            { $set: { isDefault: true, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Payment method not found' 
            });
        }

        res.json({
            success: true,
            message: 'Default payment method updated successfully'
        });
    } catch (error) {
        console.error('❌ Error setting default payment method:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to set default payment method' 
        });
    }
};

// ==========================================
// ✅ ADMIN CONTROLLERS
// ==========================================

exports.getAdminTransactions = async (req, res) => {
    try {
        const { billingHistoryCollection, usersCollection } = getCollections();
        
        let filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.plan) filter.plan = req.query.plan;

        const transactions = await billingHistoryCollection
            .find(filter)
            .sort({ date: -1 })
            .toArray();

        const userIds = [...new Set(transactions.map(t => t.userId).filter(Boolean))];

        let userEmailMap = {};
        if (userIds.length > 0) {
            const users = await usersCollection.find(
                { _id: { $in: userIds.map(id => new ObjectId(id)) } }
            ).toArray();
            
            users.forEach(u => {
                userEmailMap[u._id.toString()] = u.email || 'Unknown User';
            });
        }

        const formattedData = transactions.map((txn) => ({
            _id: txn._id,
            userEmail: userEmailMap[txn.userId] || txn.userId || 'Unknown User',
            plan: txn.plan || 'Unknown',
            amount: txn.amount || 0,
            status: txn.status || 'paid',
            transactionId: txn.transactionId || 'N/A',
            createdAt: txn.date || txn.createdAt || new Date(),
            description: txn.description || '',
        }));

        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error('❌ Error fetching admin transactions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
    }
};

exports.getAdminStats = async (req, res) => {
    try {
        const { billingHistoryCollection, usersCollection } = getCollections();
        
        const totalRevenueAgg = await billingHistoryCollection.aggregate([
            { $match: { status: "paid" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]).toArray();
        const totalRevenue = totalRevenueAgg.length > 0 ? totalRevenueAgg[0].total : 0;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyRevenueAgg = await billingHistoryCollection.aggregate([
            { 
                $match: { 
                    status: "paid", 
                    date: { $gte: startOfMonth } 
                } 
            },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]).toArray();
        const monthlyRevenue = monthlyRevenueAgg.length > 0 ? monthlyRevenueAgg[0].total : 0;

        const proUsersAgg = await billingHistoryCollection.distinct("userId", { 
            plan: { $in: ["Pro", "Growth"] } 
        });
        const activeProUsers = proUsersAgg.length;

        const enterpriseUsersAgg = await billingHistoryCollection.distinct("userId", { 
            plan: "Enterprise" 
        });
        const activeEnterpriseUsers = enterpriseUsersAgg.length;

        res.json({
            success: true,
            data: {
                totalRevenue: totalRevenue,
                monthlyRevenue: monthlyRevenue,
                activeProUsers: activeProUsers,
                activeEnterpriseUsers: activeEnterpriseUsers,
            }
        });
    } catch (error) {
        console.error('❌ Error fetching admin stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
};