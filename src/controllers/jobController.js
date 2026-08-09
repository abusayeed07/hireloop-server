const { ObjectId } = require('mongodb');
const dbUtils = require('../lib/dbUtils');
const { getCollections } = dbUtils;

// ✅ Get jobs - Everyone sees approved jobs on browse
exports.getJobs = async (req, res) => {
    try {
        console.log('📊 Fetching jobs...');
        console.log('📊 User:', req.user?.id, 'Role:', req.user?.role);
        console.log('📊 Query params:', req.query);
        
        const { jobsCollection } = getCollections();
        const query = {};

        // ✅ Apply filters from query params
        if (req.query.recruiterId) query.recruiterId = req.query.recruiterId;
        if (req.query.companyId) query.companyId = req.query.companyId;
        if (req.query.status) query.status = req.query.status;
        if (req.query.jobCategory) query.jobCategory = req.query.jobCategory;
        if (req.query.jobType) query.jobType = req.query.jobType;

        // ✅ DEFAULT: Show only approved jobs (for browse page)
        // This applies to ALL users by default
        let showOnlyApproved = true;

        // ✅ Check if this is a dashboard/management request
        const isDashboardRequest = req.query.dashboard === 'true' || 
                                   req.path.includes('/admin') ||
                                   req.path.includes('/my-jobs');

        // ✅ If it's a dashboard request, apply role-based filtering
        if (isDashboardRequest) {
            showOnlyApproved = false;
            
            // Admin: Can see all jobs
            if (req.user && req.user.role === 'admin') {
                if (req.query.adminApproval) query.adminApproval = req.query.adminApproval;
                if (req.query.status) query.status = req.query.status;
                console.log('🔍 Admin dashboard: Showing all jobs');
            }
            // Recruiter: Can see their own jobs (all statuses)
            else if (req.user && req.user.role === 'recruiter') {
                if (req.query.companyId) {
                    query.companyId = req.query.companyId;
                } else {
                    query.recruiterId = req.user.id;
                }
                delete query.status;
                delete query.isPubliclyVisible;
                delete query.adminApproval;
                console.log('🔍 Recruiter dashboard: Showing own jobs');
            }
        }

        // ✅ FOR ALL USERS ON BROWSE PAGE: Only show approved jobs
        if (showOnlyApproved) {
            query.status = 'active';
            query.isPubliclyVisible = true;
            query.adminApproval = 'approved';
            console.log('🔍 Browse mode: Showing only approved jobs');
        }

        console.log('📊 Final query:', JSON.stringify(query, null, 2));
        
        const jobs = await jobsCollection.find(query).toArray();
        console.log(`📊 Found ${jobs.length} jobs`);
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
};

// ✅ Get job by ID
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

        const userRole = req.user?.role || 'seeker';

        // ✅ Admin: Can see any job
        if (userRole === 'admin') {
            return res.json(job);
        }

        // ✅ Recruiter: Can see their own jobs
        if (userRole === 'recruiter' && job.recruiterId === req.user.id) {
            return res.json(job);
        }

        // ✅ Public/Seeker: Only see approved jobs
        if (job.status === 'active' && job.isPubliclyVisible && job.adminApproval === 'approved') {
            return res.json(job);
        }

        return res.status(403).json({ error: 'This job is not available' });
    } catch (error) {
        console.error('Error fetching job:', error);
        res.status(500).json({ error: 'Failed to fetch job' });
    }
};

// ✅ Create job - Status: pending, adminApproval: pending
exports.createJob = async (req, res) => {
    try {
        console.log('📥 [createJob] Called');
        console.log('📥 User:', req.user?.id);
        
        const { jobsCollection, adminLogsCollection } = getCollections();
        const jobData = req.body;

        const requiredFields = ['jobTitle', 'jobCategory', 'jobType', 'companyId'];
        for (const field of requiredFields) {
            if (!jobData[field]) {
                return res.status(400).json({ error: `${field} is required` });
            }
        }

        // ✅ New job: pending approval
        const newJob = {
            ...jobData,
            recruiterId: req.user.id,
            recruiterEmail: req.user.email,
            createdAt: new Date(),
            updatedAt: new Date(),
            isPubliclyVisible: jobData.isPubliclyVisible !== undefined ? jobData.isPubliclyVisible : true,
            status: 'pending',
            adminApproval: 'pending',
            adminRejectionReason: '',
            approvedAt: null,
            rejectedAt: null,
        };

        const result = await jobsCollection.insertOne(newJob);

        // ✅ Log the Action
        await adminLogsCollection.insertOne({
            action: `New Job Posted (Pending Approval): ${newJob.jobTitle} at ${newJob.companyName || 'Unknown Company'}`,
            adminEmail: req.user?.email || 'Unknown Admin',
            targetJobId: result.insertedId,
            createdAt: new Date(),
            type: 'job_creation_pending'
        });

        res.status(201).json({
            success: true,
            message: 'Job posted successfully! Waiting for admin approval.',
            insertedId: result.insertedId,
            job: { ...newJob, _id: result.insertedId }
        });
    } catch (error) {
        console.error('❌ [createJob] Error:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
};

// ✅ ✅ FIXED: Update job (Auto-Triggers Re-Review if Rejected)
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

        // Prepare update data
        const updateData = { ...req.body, updatedAt: new Date() };
        delete updateData._id;
        delete updateData.createdAt;
        delete updateData.recruiterId;
        delete updateData.companyId;

        // ✅ CRITICAL FIX: If the recruiter updates a rejected job, reset it to Pending for Admin Re-Review
        if (job.adminApproval === 'rejected' || job.status === 'rejected') {
            updateData.adminApproval = 'pending';
            updateData.status = 'pending';
            updateData.adminRejectionReason = ''; // Clear the rejection reason for the recruiter
            console.log('🔄 Job updated by recruiter. Resetting to pending for admin re-review.');
        }

        const result = await jobsCollection.updateOne(
            { _id: new ObjectId(jobId) },
            { $set: updateData }
        );

        res.json({ 
            success: true, 
            message: 'Job updated successfully. ' + (job.adminApproval === 'rejected' ? 'Sent for re-review!' : ''),
            result 
        });
    } catch (error) {
        console.error('Error updating job:', error);
        res.status(500).json({ error: 'Failed to update job' });
    }
};

// ✅ Delete job
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

// ✅ Get recruiter's jobs
exports.getMyJobs = async (req, res) => {
    try {
        console.log('📊 [getMyJobs] Called for user:', req.user?.id);
        
        const { jobsCollection, companiesCollection } = getCollections();

        if (!req.user || (req.user.role !== 'recruiter' && req.user.role !== 'admin')) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        const company = await companiesCollection.findOne({ recruiterId: req.user.id });
        
        if (!company) {
            return res.status(200).json({ 
                success: true, 
                data: [],
                message: 'No company found for this recruiter'
            });
        }

        const query = { companyId: company._id.toString() };
        const jobs = await jobsCollection.find(query).toArray();
        
        res.json({
            success: true,
            data: jobs
        });
    } catch (error) {
        console.error('Error fetching my jobs:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch jobs' 
        });
    }
};

// ✅ Toggle job status (Recruiter)
exports.toggleJobStatus = async (req, res) => {
    try {
        const { jobsCollection, adminLogsCollection } = getCollections();
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

        await adminLogsCollection.insertOne({
            action: `Job Status Changed (${newStatus === 'active' ? 'Activated' : 'Deactivated'}): ${job.jobTitle}`,
            adminEmail: req.user?.email || 'Unknown Admin',
            targetJobId: jobId,
            createdAt: new Date(),
            type: 'job_status_toggle'
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

// ✅ ==========================================
// ✅ ADMIN CONTROLLERS
// ✅ ==========================================

// ✅ ✅ NEW: Admin Get Job by ID (For the Admin Details Page)
exports.getAdminJobById = async (req, res) => {
    try {
        console.log('📊 [getAdminJobById] Called');
        console.log('📝 Job ID:', req.params.id);
        console.log('👤 Admin:', req.user?.email);

        const { jobsCollection } = getCollections();
        const jobId = req.params.id;

        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid job ID' 
            });
        }

        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });

        if (!job) {
            return res.status(404).json({ 
                success: false, 
                error: 'Job not found' 
            });
        }

        console.log('✅ Job found:', job.jobTitle);
        res.json({
            success: true,
            data: job
        });

    } catch (error) {
        console.error('❌ [getAdminJobById] Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch job' 
        });
    }
};

// ✅ Admin approve job
exports.adminApproveJob = async (req, res) => {
    try {
        console.log('✅ [adminApproveJob] Called');
        console.log('📝 Job ID:', req.params.id);
        console.log('👤 Admin:', req.user?.email);
        
        const { jobsCollection, adminLogsCollection } = getCollections();
        const jobId = req.params.id;

        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid job ID' 
            });
        }

        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });
        if (!job) {
            return res.status(404).json({ 
                success: false, 
                error: 'Job not found' 
            });
        }

        // ✅ Update job to approved
        await jobsCollection.updateOne(
            { _id: new ObjectId(jobId) },
            { 
                $set: { 
                    adminApproval: 'approved',
                    status: 'active',
                    approvedAt: new Date(),
                    updatedAt: new Date(),
                    adminRejectionReason: ''
                } 
            }
        );

        const updatedJob = await jobsCollection.findOne({ _id: new ObjectId(jobId) });

        // ✅ Log the Action
        await adminLogsCollection.insertOne({
            action: `Job Approved: ${job.jobTitle}`,
            adminEmail: req.user?.email || 'Unknown Admin',
            targetJobId: jobId,
            createdAt: new Date(),
            type: 'job_approved'
        });

        res.json({
            success: true,
            message: 'Job approved and published successfully!',
            data: updatedJob
        });
    } catch (error) {
        console.error('❌ [adminApproveJob] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve job'
        });
    }
};

// ✅ Admin reject job
exports.adminRejectJob = async (req, res) => {
    try {
        console.log('❌ [adminRejectJob] Called');
        console.log('📝 Job ID:', req.params.id);
        console.log('👤 Admin:', req.user?.email);
        
        const { jobsCollection, adminLogsCollection } = getCollections();
        const jobId = req.params.id;
        const { reason } = req.body;

        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid job ID' 
            });
        }

        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });
        if (!job) {
            return res.status(404).json({ 
                success: false, 
                error: 'Job not found' 
            });
        }

        // ✅ Update job to rejected
        await jobsCollection.updateOne(
            { _id: new ObjectId(jobId) },
            { 
                $set: { 
                    adminApproval: 'rejected',
                    status: 'pending', // ✅ FIXED: Set to 'pending' so it can be re-reviewed easily
                    rejectedAt: new Date(),
                    updatedAt: new Date(),
                    adminRejectionReason: reason || 'No reason provided'
                } 
            }
        );

        const updatedJob = await jobsCollection.findOne({ _id: new ObjectId(jobId) });

        // ✅ Log the Action
        await adminLogsCollection.insertOne({
            action: `Job Rejected: ${job.jobTitle}`,
            adminEmail: req.user?.email || 'Unknown Admin',
            targetJobId: jobId,
            createdAt: new Date(),
            type: 'job_rejected',
            reason: reason || 'No reason provided'
        });

        res.json({
            success: true,
            message: 'Job rejected successfully',
            data: updatedJob
        });
    } catch (error) {
        console.error('❌ [adminRejectJob] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject job'
        });
    }
};

// ✅ Recruiter requests re-review
exports.requestReReview = async (req, res) => {
    try {
        console.log('🔄 [requestReReview] Called');
        console.log('📝 Job ID:', req.params.id);
        console.log('👤 Recruiter:', req.user?.email);
        
        const { jobsCollection, adminLogsCollection } = getCollections();
        const jobId = req.params.id;
        const { message } = req.body;

        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid job ID' 
            });
        }

        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });
        if (!job) {
            return res.status(404).json({ 
                success: false, 
                error: 'Job not found' 
            });
        }

        // ✅ Check if recruiter owns this job
        if (job.recruiterId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'You can only request re-review for your own jobs'
            });
        }

        // ✅ Update job to pending review
        await jobsCollection.updateOne(
            { _id: new ObjectId(jobId) },
            { 
                $set: { 
                    adminApproval: 'pending',
                    status: 'pending',
                    updatedAt: new Date(),
                },
                $push: {
                    reReviewRequests: {
                        requestedAt: new Date(),
                        message: message || 'Requesting re-review',
                        requestedBy: req.user.email,
                    }
                }
            }
        );

        const updatedJob = await jobsCollection.findOne({ _id: new ObjectId(jobId) });

        // ✅ Log the Action
        await adminLogsCollection.insertOne({
            action: `Re-Review Requested for Job: ${job.jobTitle}`,
            adminEmail: req.user?.email || 'Unknown',
            targetJobId: jobId,
            createdAt: new Date(),
            type: 're_review_requested',
            message: message || 'Requesting re-review'
        });

        res.json({
            success: true,
            message: 'Re-review requested successfully. Admin will review your job again.',
            data: updatedJob
        });
    } catch (error) {
        console.error('❌ [requestReReview] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to request re-review'
        });
    }
};

// ✅ Get admin jobs with filters
exports.getAdminJobs = async (req, res) => {
    try {
        console.log('📊 [getAdminJobs] Called');
        const { jobsCollection } = getCollections();
        const query = {};

        if (req.query.status) query.status = req.query.status;
        if (req.query.adminApproval) query.adminApproval = req.query.adminApproval;
        if (req.query.jobCategory) query.jobCategory = req.query.jobCategory;
        if (req.query.companyId) query.companyId = req.query.companyId;

        const jobs = await jobsCollection.find(query).toArray();
        res.json({ success: true, data: jobs });
    } catch (error) {
        console.error('❌ Error fetching admin jobs:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
    }
};

// ✅ Get admin stats
exports.getAdminStats = async (req, res) => {
    try {
        const { jobsCollection } = getCollections();
        
        const totalJobs = await jobsCollection.countDocuments();
        const activeJobs = await jobsCollection.countDocuments({ status: 'active' });
        const closedJobs = await jobsCollection.countDocuments({ status: 'closed' });
        const pendingApproval = await jobsCollection.countDocuments({ adminApproval: 'pending' });
        const rejectedJobs = await jobsCollection.countDocuments({ adminApproval: 'rejected' });

        res.json({
            success: true,
            data: {
                engagementRate: 82.4, 
                avgTimeToFill: 14,
                totalApplications: totalJobs * 5, 
                totalJobs,
                activeJobs,
                closedJobs,
                pendingApproval,
                rejectedJobs
            }
        });
    } catch (error) {
        console.error('❌ Error fetching admin stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
};

// ✅ Delete job (Admin override)
exports.adminDeleteJob = async (req, res) => {
    try {
        const { jobsCollection, adminLogsCollection } = getCollections();
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
        await adminLogsCollection.insertOne({
            action: `Admin Force Deleted Job: ${job.jobTitle}`,
            adminEmail: req.user?.email || 'Unknown Admin',
            targetJobId: jobId,
            createdAt: new Date(),
            type: 'job_deleted'
        });

        res.json({ success: true, message: 'Job deleted successfully by Admin.' });
    } catch (error) {
        console.error('❌ Error deleting job:', error);
        res.status(500).json({ success: false, error: 'Failed to delete job' });
    }
};