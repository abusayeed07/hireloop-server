// src/hooks/userHooks.js
const { getCollections } = require('../lib/dbUtils');

// ✅ This runs automatically whenever Better Auth creates a new user
exports.onUserCreate = async (user) => {
    try {
        console.log('📝 onUserCreate called with user:', user);
        
        const { adminLogsCollection } = getCollections();

        const userName = user?.name || 'Unknown User';
        const userEmail = user?.email || 'Unknown Email';
        const userRole = user?.role || 'Seeker';
        // ✅ Get user ID - Better Auth uses 'id' not '_id'
        const userId = user?.id || user?._id || 'unknown';

        console.log(`📝 Logging new user registration: ${userEmail} (ID: ${userId})`);

        // ✅ Insert admin log
        const result = await adminLogsCollection.insertOne({
            action: `New User Registered: ${userName} (${userEmail}) - Role: ${userRole}`,
            adminEmail: 'System Automation',
            targetUserId: userId.toString(), // Ensure it's saved as a string
            createdAt: new Date(),
            type: 'signup'
        });

        console.log(`✅ New user registration logged successfully: ${userEmail} (Log ID: ${result.insertedId})`);
    } catch (error) {
        console.error('❌ Error logging user registration:', error);
        console.error('❌ Error details:', error.message);
    }
};