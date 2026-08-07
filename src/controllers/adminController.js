const { getCollections } = require('../lib/dbUtils');

// ✅ 1. Get Admin Activity Log
exports.getAdminLogs = async (req, res) => {
    try {
        const { adminLogsCollection } = getCollections();
        const logs = await adminLogsCollection
            .find()
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
            
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('❌ Error fetching admin logs:', error);
        res.json({ success: true, data: [] });
    }
};

// ✅ 2. Invite New Admin
exports.inviteAdmin = async (req, res) => {
    try {
        const { usersCollection } = getCollections();
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found with this email' });
        }
        
        await usersCollection.updateOne(
            { _id: user._id }, 
            { $set: { role: 'admin' } }
        );
        
        res.json({ success: true, message: `Admin permissions granted to ${email}` });
    } catch (error) {
        console.error('❌ Error inviting admin:', error);
        res.status(500).json({ success: false, error: 'Failed to invite admin' });
    }
};

// ✅ 3. Get Platform Settings
exports.getSettings = async (req, res) => {
    try {
        const { settingsCollection } = getCollections();
        const settings = await settingsCollection.findOne({ _id: 'global_settings' });
        
        if (!settings) {
            return res.json({
                success: true,
                data: {
                    siteName: 'HireLoop',
                    siteLogo: null,
                    currency: 'USD',
                    maxFreeJobs: 3,
                    maxFreeApplications: 10,
                    isMaintenanceMode: false
                }
            });
        }
        
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('❌ Error fetching settings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
};

// ✅ 4. Update Platform Settings
exports.updateSettings = async (req, res) => {
    try {
        const { settingsCollection } = getCollections();
        const updates = req.body;
        
        await settingsCollection.updateOne(
            { _id: 'global_settings' }, 
            { $set: updates }, 
            { upsert: true }
        );
        
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('❌ Error updating settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
};