const { ObjectId } = require('mongodb');
const { getCollections } = require('../lib/dbUtils');

exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user?.id || req.params?.userId || req.body?.userId;
        
        console.log(`🗑️ Delete account request for user: ${userId}`);
        console.log(`📋 Request user from auth:`, req.user);
        console.log(`📋 Request params:`, req.params);
        
        if (!userId) {
            return res.status(400).json({ 
                success: false,
                error: 'User ID is required' 
            });
        }

        const { usersCollection, applicationsCollection, savedJobsCollection, adminLogsCollection } = getCollections(); // Added adminLogsCollection

        // 1. Fetch user details BEFORE deletion
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        const userName = user?.name || 'Unknown User';
        const userEmail = user?.email || 'Unknown Email';

        // 2. Delete user's applications
        try {
            await applicationsCollection.deleteMany({ userId: new ObjectId(userId) });
            console.log(`✅ Deleted applications for user: ${userId}`);
        } catch (err) {
            console.log(`⚠️ No applications found or error deleting: ${err.message}`);
        }

        // 3. Delete user's saved jobs
        try {
            await savedJobsCollection.deleteMany({ userId: new ObjectId(userId) });
            console.log(`✅ Deleted saved jobs for user: ${userId}`);
        } catch (err) {
            console.log(`⚠️ No saved jobs found or error deleting: ${err.message}`);
        }

        // 4. Delete the user account
        const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }

        console.log(`✅ Account deleted successfully for user: ${userId}`);

        // ✅ Log the Action
        await adminLogsCollection.insertOne({
            action: `User Deleted Own Account: ${userName} (${userEmail})`,
            adminEmail: 'System Automation',
            targetUserId: userId,
            createdAt: new Date()
        });

        res.json({ 
            success: true, 
            message: 'Account deleted successfully',
            data: {
                userId: userId,
                deletedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("❌ Error deleting account:", error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete account',
            details: error.message 
        });
    }
};