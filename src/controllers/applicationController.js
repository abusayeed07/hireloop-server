// backend/src/controllers/applicationsController.js
const { ObjectId } = require('mongodb');
const { getCollections } = require('../lib/dbUtils');

// ✅ Get applications for a specific user (existing function)
exports.getAllApplications = async (req, res) => {
    try {
        const { applicationsCollection } = getCollections();
        const query = {};
        
        if (req.user) {
            query.applicantId = req.user.id;
        } else if (req.query.userId) {
            query.applicantId = req.query.userId;
        } else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        if (req.query.jobId) {
            query.jobId = req.query.jobId;
        }
        
        const result = await applicationsCollection.find(query).toArray();
        console.log(`📝 Found ${result.length} applications for user ${query.applicantId}`);
        res.send(result);
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
};

// ✅ NEW: Get ALL applications (Admin only)
exports.getAllApplicationsAdmin = async (req, res) => {
    try {
        console.log('🔐🔐🔐 ADMIN getAllApplicationsAdmin called!');
        console.log('👤 Admin:', req.user?.email);
        
        const { applicationsCollection } = getCollections();
        
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;
        
        // Filters
        const status = req.query.status || '';
        const jobId = req.query.jobId || '';
        const search = req.query.search || '';
        
        let filter = {};
        
        if (status && status !== 'all') {
            filter.status = status;
        }
        
        if (jobId && jobId !== 'all') {
            filter.jobId = jobId;
        }
        
        if (search) {
            filter.$or = [
                { applicantName: { $regex: search, $options: 'i' } },
                { applicantEmail: { $regex: search, $options: 'i' } },
                { jobTitle: { $regex: search, $options: 'i' } }
            ];
        }
        
        const total = await applicationsCollection.countDocuments(filter);
        
        const applications = await applicationsCollection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        
        console.log(`📊 Found ${applications.length} applications (total: ${total})`);
        
        res.json({
            success: true,
            data: applications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('❌ Error fetching all applications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch applications',
            details: error.message
        });
    }
};

// ✅ Get application stats (Admin only)
exports.getApplicationStats = async (req, res) => {
    try {
        console.log('📊 GET APPLICATION STATS called!');
        console.log('👤 Admin:', req.user?.email);
        
        const { applicationsCollection } = getCollections();
        
        const [
            total,
            pending,
            underReview,
            shortlisted,
            rejected,
            offered,
            hired
        ] = await Promise.all([
            applicationsCollection.countDocuments(),
            applicationsCollection.countDocuments({ status: 'pending' }),
            applicationsCollection.countDocuments({ status: 'under_review' }),
            applicationsCollection.countDocuments({ status: 'shortlisted' }),
            applicationsCollection.countDocuments({ status: 'rejected' }),
            applicationsCollection.countDocuments({ status: 'offered' }),
            applicationsCollection.countDocuments({ status: 'hired' })
        ]);
        
        res.json({
            success: true,
            data: {
                total,
                pending,
                underReview,
                shortlisted,
                rejected,
                offered,
                hired
            }
        });
    } catch (error) {
        console.error('❌ Error getting application stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get application stats'
        });
    }
};

// ✅ Update application status (Admin only)
exports.updateApplicationStatus = async (req, res) => {
    try {
        console.log('📝 UPDATE APPLICATION STATUS called!');
        console.log('📝 Application ID:', req.params.id);
        console.log('📝 Status:', req.body.status);
        console.log('👤 Admin:', req.user?.email);
        
        const { applicationsCollection, adminLogsCollection } = getCollections();
        const { id } = req.params;
        const { status } = req.body;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid application ID'
            });
        }
        
        const application = await applicationsCollection.findOne({ _id: new ObjectId(id) });
        if (!application) {
            return res.status(404).json({
                success: false,
                error: 'Application not found'
            });
        }
        
        const result = await applicationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: status, updatedAt: new Date() } }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Application not found'
            });
        }
        
        // Log the action
        await adminLogsCollection.insertOne({
            action: `Admin updated application status: ${application.jobTitle || 'Job'} -> ${status}`,
            adminEmail: req.user?.email || 'Unknown Admin',
            targetUserId: application.applicantId,
            targetJobId: application.jobId,
            createdAt: new Date(),
            type: 'application_status_update'
        });
        
        res.json({
            success: true,
            message: `Application status updated to ${status}`,
            data: {
                id: id,
                status: status
            }
        });
    } catch (error) {
        console.error('❌ Error updating application status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update application status'
        });
    }
};

// ✅ Get application by ID (Admin only)
exports.getApplicationById = async (req, res) => {
    try {
        console.log('👤 GET APPLICATION BY ID called!');
        console.log('📝 Application ID:', req.params.id);
        
        const { applicationsCollection } = getCollections();
        const { id } = req.params;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid application ID'
            });
        }
        
        const application = await applicationsCollection.findOne({ _id: new ObjectId(id) });
        
        if (!application) {
            return res.status(404).json({
                success: false,
                error: 'Application not found'
            });
        }
        
        res.json({
            success: true,
            data: application
        });
    } catch (error) {
        console.error('❌ Error fetching application:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch application'
        });
    }
};

// ✅ Get applications by job ID (Admin only)
exports.getApplicationsByJob = async (req, res) => {
    try {
        console.log('📝 GET APPLICATIONS BY JOB called!');
        console.log('📝 Job ID:', req.params.jobId);
        
        const { applicationsCollection } = getCollections();
        const { jobId } = req.params;
        
        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid job ID'
            });
        }
        
        const applications = await applicationsCollection
            .find({ jobId: jobId })
            .sort({ createdAt: -1 })
            .toArray();
        
        res.json({
            success: true,
            data: applications,
            count: applications.length
        });
    } catch (error) {
        console.error('❌ Error fetching applications by job:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch applications'
        });
    }
};

// ✅ Create application (existing function)
exports.createApplication = async (req, res) => {
    try {
        const { applicationsCollection, adminLogsCollection, jobsCollection, usersCollection } = getCollections();
        const application = req.body;
        const newApplication = {
            ...application,
            applicantId: req.user.id,
            createdAt: new Date(),
            status: 'pending'
        };
        const result = await applicationsCollection.insertOne(newApplication);

        // Log the Action
        const user = await usersCollection.findOne({ _id: new ObjectId(req.user.id) });
        const userName = user?.name || 'Unknown User';
        const userEmail = user?.email || 'Unknown Email';
        const job = await jobsCollection.findOne({ _id: new ObjectId(application.jobId) });
        const jobTitle = job?.jobTitle || 'Unknown Job';

        await adminLogsCollection.insertOne({
            action: `New Job Application: ${userName} (${userEmail}) applied for "${jobTitle}"`,
            adminEmail: 'System Automation',
            targetUserId: req.user.id,
            targetJobId: application.jobId,
            createdAt: new Date()
        });

        res.send({
            success: true,
            message: 'Application submitted successfully',
            applicationId: result.insertedId
        });
    } catch (error) {
        console.error('Error creating application:', error);
        res.status(500).json({ error: 'Failed to submit application' });
    }
};