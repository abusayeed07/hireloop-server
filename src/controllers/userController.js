// backend/src/controllers/userController.js
const { ObjectId } = require('mongodb');
const { getCollections } = require('../lib/dbUtils');

// ✅ PUBLIC route - for non-admin users (limited data)
exports.getPublicUsers = async (req, res) => {
    try {
        console.log('🌐🌐🌐 PUBLIC getPublicUsers called!');
        const { usersCollection } = getCollections();
        
        const users = await usersCollection.find({})
            .limit(10)
            .project({ password: 0, password_hash: 0 })
            .toArray();

        res.json({
            success: true,
            data: users,
            message: 'Public route - limited to 10 users'
        });
    } catch (error) {
        console.error('❌ Public route error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        console.log('🔐🔐🔐 ADMIN getAllUsers called!');
        console.log('👤 User:', req.user?.email || 'No user');
        console.log('🔑 Role:', req.user?.role || 'No role');
        console.log('📝 Query params:', req.query);
        
        const { usersCollection } = getCollections();
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const role = req.query.role || '';
        const status = req.query.status || '';

        let filter = {};
        
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (role && role !== 'all') {
            filter.role = role;
        }
        
        if (status && status !== 'all') {
            filter.status = status;
        }

        console.log('📝 Filter:', JSON.stringify(filter, null, 2));

        const total = await usersCollection.countDocuments(filter);
        console.log(`📊 Total users matching filter: ${total}`);
        
        const cursor = usersCollection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const users = await cursor.toArray();
        console.log(`📊 Found ${users.length} users in this page`);
        
        if (users.length > 0) {
            console.log('👤 First user:', users[0].email, 'Role:', users[0].role);
        }

        const sanitizedUsers = users.map(user => {
            const { password, password_hash, ...safeUser } = user;
            return safeUser;
        });

        res.json({
            success: true,
            data: sanitizedUsers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        console.error('❌ Stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch users',
            details: error.message 
        });
    }
};

// ✅ Get single user by ID
exports.getUserById = async (req, res) => {
    try {
        const { usersCollection } = getCollections();
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }

        const user = await usersCollection.findOne({ _id: new ObjectId(id) });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const { password, password_hash, ...safeUser } = user;

        res.json({
            success: true,
            data: safeUser
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user'
        });
    }
};

// ✅ Update user (Admin only)
exports.updateUser = async (req, res) => {
    try {
        const { usersCollection, sessionCollection, adminLogsCollection } = getCollections();
        const { id } = req.params;
        const { action } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }

        const user = await usersCollection.findOne({ _id: new ObjectId(id) });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        let updateData = {};
        let message = '';

        switch (action) {
            case 'suspend':
                updateData = {
                    status: 'suspended',
                    suspendedAt: new Date(),
                    updatedAt: new Date()
                };
                message = 'User suspended successfully';
                break;

            case 'activate':
                updateData = {
                    status: 'active',
                    suspendedAt: null,
                    updatedAt: new Date()
                };
                message = 'User activated successfully';
                break;

            case 'make_seeker':
                updateData = {
                    role: 'seeker',
                    plan: 'seeker_free',
                    updatedAt: new Date()
                };
                message = 'User role updated to Seeker';
                break;

            case 'make_recruiter':
                updateData = {
                    role: 'recruiter',
                    plan: 'recruiter_free',
                    updatedAt: new Date()
                };
                message = 'User role updated to Recruiter';
                break;

            case 'make_admin':
                updateData = {
                    role: 'admin',
                    plan: 'admin',
                    updatedAt: new Date()
                };
                message = 'User role updated to Admin';
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Allowed: suspend, activate, make_seeker, make_recruiter, make_admin'
                });
        }

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // ✅ IMMEDIATE SESSION KILL FIX
        if (action === 'suspend') {
            await sessionCollection.deleteMany({ userId: id });
        }

        const updatedUser = await usersCollection.findOne({ _id: new ObjectId(id) });
        const { password, password_hash, ...safeUser } = updatedUser;

        // ✅ Log the Action
        const adminEmail = req.user?.email || 'Unknown Admin';
        await adminLogsCollection.insertOne({
            action: `Admin updated user: ${safeUser.email} -> ${message}`,
            adminEmail: adminEmail,
            targetUserId: id,
            createdAt: new Date()
        });

        res.json({
            success: true,
            message,
            data: safeUser
        });

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user'
        });
    }
};

// ✅ Delete user (Admin only)
exports.deleteUser = async (req, res) => {
    try {
        const { 
            usersCollection, 
            sessionCollection, 
            accountCollection,
            applicationsCollection,
            savedJobsCollection,
            billingHistoryCollection,
            adminLogsCollection
        } = getCollections();
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }

        const user = await usersCollection.findOne({ _id: new ObjectId(id) });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        await Promise.all([
            usersCollection.deleteOne({ _id: new ObjectId(id) }),
            sessionCollection.deleteMany({ userId: id }),
            accountCollection.deleteMany({ userId: id }),
            applicationsCollection.deleteMany({ applicantId: id }),
            savedJobsCollection.deleteMany({ userId: id }),
            billingHistoryCollection.deleteMany({ userId: id })
        ]);

        // ✅ Log the Action
        const adminEmail = req.user?.email || 'Unknown Admin';
        await adminLogsCollection.insertOne({
            action: `Admin permanently deleted user: ${user.email} (${user.name || 'Unknown'})`,
            adminEmail: adminEmail,
            targetUserId: id,
            createdAt: new Date()
        });

        res.json({
            success: true,
            message: 'User deleted successfully',
            data: {
                id: id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user'
        });
    }
};

// ✅ Get user stats (Admin only)
exports.getUserStats = async (req, res) => {
    try {
        const { usersCollection } = getCollections();

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            activeUsers,
            recruiterCount,
            seekerCount,
            adminCount,
            suspendedCount,
            newSignups
        ] = await Promise.all([
            usersCollection.countDocuments(),
            usersCollection.countDocuments({ status: 'active' }),
            usersCollection.countDocuments({ 
                role: 'recruiter',
                status: { $ne: 'suspended' }
            }),
            usersCollection.countDocuments({ 
                role: 'seeker',
                status: { $ne: 'suspended' }
            }),
            usersCollection.countDocuments({ 
                role: 'admin' 
            }),
            usersCollection.countDocuments({ 
                status: 'suspended' 
            }),
            usersCollection.countDocuments({ 
                createdAt: { $gte: twentyFourHoursAgo } 
            })
        ]);

        res.json({
            success: true,
            data: {
                totalUsers,
                activeUsers,
                recruiterCount,
                seekerCount,
                adminCount,
                suspendedCount,
                newSignups
            }
        });

    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user stats'
        });
    }
};

// ✅ Get profile (Current user)
exports.getProfile = async (req, res) => {
    try {
        const { usersCollection } = getCollections();
        
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required' 
            });
        }
        
        const userId = req.user.id;
        
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }
        
        const user = await usersCollection.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }
        
        const { password, password_hash, ...safeUser } = user;
        
        res.json({
            success: true,
            data: safeUser
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch profile' 
        });
    }
};

// backend/src/controllers/userController.js

// ✅ Log user signup (called from frontend after successful signup)
exports.logUserSignup = async (req, res) => {
    try {
        console.log('🔍🔍🔍 logUserSignup called!');
        console.log('📝 Request body:', req.body);
        console.log('📝 Headers:', req.headers);
        
        const { adminLogsCollection } = getCollections();
        const { email, name, role, userId } = req.body;

        console.log(`📝 Logging signup for: ${email}`);
        console.log(`📝 Name: ${name}, Role: ${role}, UserId: ${userId}`);

        // Check if adminLogsCollection exists
        console.log('📝 Checking adminLogsCollection...');
        if (!adminLogsCollection) {
            console.error('❌ adminLogsCollection is null or undefined!');
            return res.status(500).json({ 
                success: false, 
                error: 'Database collection not available' 
            });
        }

        const result = await adminLogsCollection.insertOne({
            action: `New User Registered: ${name || 'Unknown'} (${email}) - Role: ${role || 'seeker'}`,
            adminEmail: 'System Automation',
            targetUserId: userId || 'unknown',
            createdAt: new Date(),
            type: 'signup'
        });

        console.log(`✅ User signup logged successfully! Log ID: ${result.insertedId}`);
        res.json({ success: true, logId: result.insertedId });
    } catch (error) {
        console.error('❌ Error logging user signup:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack 
        });
    }
};