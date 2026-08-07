const { ObjectId } = require('mongodb');
const dbUtils = require('../lib/dbUtils');
const { getCollections } = dbUtils;

// ✅ Make getJobs public (no auth required)
exports.getJobs = async (req, res) => {
    try {
        console.log('📊 Fetching jobs...');
        const { jobsCollection } = getCollections();
        const query = {};

        if (req.query.recruiterId) query.recruiterId = req.query.recruiterId;
        if (req.query.companyId) query.companyId = req.query.companyId;
        if (req.query.status) query.status = req.query.status;
        if (req.query.jobCategory) query.jobCategory = req.query.jobCategory;
        if (req.query.jobType) query.jobType = req.query.jobType;

        if (!req.user || req.user.role === 'seeker') {
            query.status = 'active';
            query.isPubliclyVisible = true;
        }

        const jobs = await jobsCollection.find(query).toArray();
        console.log(`📊 Found ${jobs.length} jobs`);
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
};

exports.getJobById = async (req, res) => {
    try {
        const { jobsCollection } = getCollections();
        const jobId = req.params.id;

        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID' });
        }

        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status !== 'active') {
            if (req.user && req.user.role === 'admin') {
                return res.json(job);
            }
            return res.status(403).json({ error: 'This job is not available' });
        }

        return res.json(job);
    } catch (error) {
        console.error('Error fetching job:', error);
        res.status(500).json({ error: 'Failed to fetch job' });
    }
};

exports.createJob = async (req, res) => {
    try {
        const { jobsCollection, adminLogsCollection } = getCollections(); // Added adminLogsCollection
        const jobData = req.body;

        const requiredFields = ['jobTitle', 'jobCategory', 'jobType', 'companyId'];
        for (const field of requiredFields) {
            if (!jobData[field]) {
                return res.status(400).json({ error: `${field} is required` });
            }
        }

        const newJob = {
            ...jobData,
            recruiterId: req.user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            isPubliclyVisible: jobData.isPubliclyVisible !== undefined ? jobData.isPubliclyVisible : true,
            status: jobData.status || 'active',
        };

        const result = await jobsCollection.insertOne(newJob);

        // ✅ Log the Action
        const adminEmail = req.user?.email || 'Unknown Admin';
        await adminLogsCollection.insertOne({
            action: `New Job Posted: ${newJob.jobTitle} at ${newJob.companyName || 'Unknown Company'}`,
            adminEmail: adminEmail,
            targetJobId: result.insertedId,
            createdAt: new Date()
        });

        res.status(201).json({
            success: true,
            insertedId: result.insertedId,
            job: { ...newJob, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
};

exports.updateJob = async (req, res) => {
    try {
        const { jobsCollection } = getCollections();
        const jobId = req.params.id;

        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID' });
        }

        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (req.user.role !== 'admin' && job.recruiterId !== req.user.id) {
            return res.status(403).json({ error: 'You can only update your own jobs' });
        }

        const updateData = { ...req.body, updatedAt: new Date() };
        delete updateData._id;
        delete updateData.createdAt;
        delete updateData.recruiterId;
        delete updateData.companyId;

        const result = await jobsCollection.updateOne(
            { _id: new ObjectId(jobId) },
            { $set: updateData }
        );

        res.json({ success: true, message: 'Job updated successfully', result });
    } catch (error) {
        console.error('Error updating job:', error);
        res.status(500).json({ error: 'Failed to update job' });
    }
};

exports.deleteJob = async (req, res) => {
    try {
        const { jobsCollection } = getCollections();
        const jobId = req.params.id;

        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID' });
        }

        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (req.user.role !== 'admin' && job.recruiterId !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own jobs' });
        }

        const result = await jobsCollection.deleteOne({ _id: new ObjectId(jobId) });

        res.json({ success: true, message: 'Job deleted successfully', result });
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ error: 'Failed to delete job' });
    }
};

exports.getMyJobs = async (req, res) => {
    try {
        const { jobsCollection, companiesCollection } = getCollections();

        if (!req.user || (req.user.role !== 'recruiter' && req.user.role !== 'admin')) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // ✅ Step 1: Find the recruiter's company
        const company = await companiesCollection.findOne({ recruiterId: req.user.id });
        
        if (!company) {
            return res.status(404).json({ 
                success: false, 
                error: 'No company found for this recruiter' 
            });
        }

        // ✅ Step 2: Get jobs for that company
        const query = { companyId: company._id.toString() };
        const jobs = await jobsCollection.find(query).toArray();
        
        res.json({
            success: true,
            data: jobs
        });
    } catch (error) {
        console.error('Error fetching my jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
};

exports.toggleJobStatus = async (req, res) => {
    try {
        const { jobsCollection, adminLogsCollection } = getCollections(); // Added adminLogsCollection
        const jobId = req.params.id;

        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID' });
        }

        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (req.user.role !== 'admin' && job.recruiterId !== req.user.id) {
            return res.status(403).json({ error: 'You can only manage your own jobs' });
        }

        const newStatus = job.status === 'active' ? 'inactive' : 'active';

        const result = await jobsCollection.updateOne(
            { _id: new ObjectId(jobId) },
            { $set: { status: newStatus, updatedAt: new Date() } }
        );

        // ✅ Log the Action
        const adminEmail = req.user?.email || 'Unknown Admin';
        await adminLogsCollection.insertOne({
            action: `Job Status Changed (${newStatus === 'active' ? 'Activated' : 'Deactivated'}): ${job.jobTitle}`,
            adminEmail: adminEmail,
            targetJobId: jobId,
            createdAt: new Date()
        });

        res.json({
            success: true,
            message: `Job ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
            status: newStatus,
            result
        });
    } catch (error) {
        console.error('Error toggling job status:', error);
        res.status(500).json({ error: 'Failed to toggle job status' });
    }
};

// ==========================================
// ✅ ADMIN CONTROLLERS
// ==========================================

exports.getAdminJobs = async (req, res) => {
    try {
        const { jobsCollection } = getCollections();
        const query = {};

        if (req.query.status) query.status = req.query.status;
        if (req.query.jobCategory) query.jobCategory = req.query.jobCategory;
        if (req.query.companyId) query.companyId = req.query.companyId;

        const jobs = await jobsCollection.find(query).toArray();
        res.json({ success: true, data: jobs });
    } catch (error) {
        console.error('❌ Error fetching admin jobs:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
    }
};

exports.getAdminStats = async (req, res) => {
    try {
        const { jobsCollection } = getCollections();
        
        const totalJobs = await jobsCollection.countDocuments();
        const activeJobs = await jobsCollection.countDocuments({ status: 'active' });
        const closedJobs = await jobsCollection.countDocuments({ status: 'closed' });

        res.json({
            success: true,
            data: {
                engagementRate: 82.4, 
                avgTimeToFill: 14,
                totalApplications: totalJobs * 5, 
                totalJobs,
                activeJobs,
                closedJobs
            }
        });
    } catch (error) {
        console.error('❌ Error fetching admin stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
};

// ✅ Delete job (Admin override - unlimited power)
exports.adminDeleteJob = async (req, res) => {
    try {
        const { jobsCollection, adminLogsCollection } = getCollections(); // Added adminLogsCollection
        const jobId = req.params.id;

        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ success: false, error: 'Invalid job ID' });
        }

        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });
        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }

        await jobsCollection.deleteOne({ _id: new ObjectId(jobId) });

        // ✅ Log the Action
        const adminEmail = req.user?.email || 'Unknown Admin';
        await adminLogsCollection.insertOne({
            action: `Admin Force Deleted Job: ${job.jobTitle}`,
            adminEmail: adminEmail,
            targetJobId: jobId,
            createdAt: new Date()
        });

        res.json({ success: true, message: 'Job deleted successfully by Admin.' });
    } catch (error) {
        console.error('❌ Error deleting job:', error);
        res.status(500).json({ success: false, error: 'Failed to delete job' });
    }
};