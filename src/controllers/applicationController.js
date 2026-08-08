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

// ✅ Get my applications (Seeker)
exports.getMyApplications = async (req, res) => {
    try {
        console.log('📊 [getMyApplications] Called for user:', req.user?.id);
        const { applicationsCollection, jobsCollection } = getCollections();
        const userId = req.user.id;

        const applications = await applicationsCollection
            .find({ applicantId: userId })
            .sort({ appliedAt: -1, createdAt: -1 })
            .toArray();

        // ✅ Enrich with job details
        const enrichedApplications = await Promise.all(
            applications.map(async (app) => {
                try {
                    const job = await jobsCollection.findOne({ _id: new ObjectId(app.jobId) });
                    return {
                        ...app,
                        job: job || null,
                        jobTitle: app.jobTitle || job?.jobTitle || 'Unknown Job',
                        companyName: app.companyName || job?.companyName || 'Unknown Company',
                    };
                } catch (err) {
                    return {
                        ...app,
                        job: null,
                        jobTitle: app.jobTitle || 'Unknown Job',
                        companyName: app.companyName || 'Unknown Company',
                    };
                }
            })
        );

        console.log(`✅ Found ${enrichedApplications.length} applications for user ${userId}`);

        res.json({
            success: true,
            data: enrichedApplications
        });
    } catch (error) {
        console.error('❌ [getMyApplications] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch applications'
        });
    }
};

// ✅ Get all applications for a recruiter's company
exports.getRecruiterApplications = async (req, res) => {
    try {
        console.log('📊 [getRecruiterApplications] Called for user:', req.user?.id);
        const { applicationsCollection, jobsCollection, companiesCollection } = getCollections();
        const userId = req.user.id;

        // ✅ Find recruiter's company
        const company = await companiesCollection.findOne({ recruiterId: userId });
        if (!company) {
            console.log('❌ No company found for recruiter:', userId);
            return res.status(404).json({
                success: false,
                error: 'No company found for this recruiter'
            });
        }

        console.log('✅ Found company:', company.name, company._id);

        // ✅ Find all jobs for this company
        const jobs = await jobsCollection
            .find({ companyId: company._id.toString() })
            .toArray();
        
        const jobIds = jobs.map(job => job._id.toString());
        console.log(`✅ Found ${jobIds.length} jobs for company`);

        // ✅ Find all applications for these jobs
        const applications = await applicationsCollection
            .find({ jobId: { $in: jobIds } })
            .sort({ appliedAt: -1, createdAt: -1 })
            .toArray();

        console.log(`✅ Found ${applications.length} applications for recruiter`);

        res.json({
            success: true,
            data: applications,
            company: company
        });
    } catch (error) {
        console.error('❌ [getRecruiterApplications] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch applications'
        });
    }
};

// ✅ Get application statistics for recruiter
exports.getRecruiterStats = async (req, res) => {
    try {
        console.log('📊 [getRecruiterStats] Called for user:', req.user?.id);
        const { applicationsCollection, jobsCollection, companiesCollection } = getCollections();
        const userId = req.user.id;

        // ✅ Find recruiter's company
        const company = await companiesCollection.findOne({ recruiterId: userId });
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'No company found for this recruiter'
            });
        }

        // ✅ Find all jobs for this company
        const jobs = await jobsCollection
            .find({ companyId: company._id.toString() })
            .toArray();
        
        const jobIds = jobs.map(job => job._id.toString());

        // ✅ Count applications by status
        const applications = await applicationsCollection
            .find({ jobId: { $in: jobIds } })
            .toArray();

        const stats = {
            total: applications.length,
            pending: applications.filter(a => a.status === 'pending' || a.status === 'applied').length,
            reviewed: applications.filter(a => a.status === 'reviewed' || a.status === 'review').length,
            shortlisted: applications.filter(a => a.status === 'shortlisted').length,
            interviewed: applications.filter(a => a.status === 'interview' || a.status === 'interviewing').length,
            rejected: applications.filter(a => a.status === 'rejected').length,
            hired: applications.filter(a => a.status === 'hired' || a.status === 'accepted' || a.status === 'offered').length,
        };

        console.log('✅ Stats calculated:', stats);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ [getRecruiterStats] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch application stats'
        });
    }
};

// ✅ Update application status (Recruiter) - FIXED: Checks COMPANY ownership
exports.updateApplicationStatusRecruiter = async (req, res) => {
    try {
        console.log('📝 [updateApplicationStatusRecruiter] Called!');
        console.log('📝 Application ID:', req.params.id);
        console.log('📝 Status:', req.body.status);
        console.log('📝 Notes:', req.body.recruiterNotes);
        console.log('👤 User ID:', req.user?.id);
        console.log('👤 User Email:', req.user?.email);
        console.log('👤 User Role:', req.user?.role);
        
        const { applicationsCollection, jobsCollection, companiesCollection, adminLogsCollection } = getCollections();
        const { id } = req.params;
        const { status, recruiterNotes } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid application ID'
            });
        }

        // ✅ Check if application exists
        const application = await applicationsCollection.findOne({ _id: new ObjectId(id) });
        if (!application) {
            console.log('❌ Application not found:', id);
            return res.status(404).json({
                success: false,
                error: 'Application not found'
            });
        }
        console.log('📝 Application found:', application.jobTitle);
        console.log('📝 Job ID from application:', application.jobId);

        // ✅ Check if job exists
        const job = await jobsCollection.findOne({ _id: new ObjectId(application.jobId) });
        if (!job) {
            console.log('❌ Job not found:', application.jobId);
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }
        console.log('📝 Job found:', job.jobTitle);
        console.log('📝 Company ID:', job.companyId);

        // ✅ FIX: Check if user owns the COMPANY (not the job)
        const company = await companiesCollection.findOne({ _id: new ObjectId(job.companyId) });
        console.log('📝 Company found:', company?.name);
        console.log('📝 Company recruiterId:', company?.recruiterId);
        console.log('👤 Current user ID:', userId);

        // ✅ Check ownership: Does the user own this company?
        let isOwner = false;
        let isAdmin = userRole === 'admin';

        if (company && company.recruiterId) {
            isOwner = company.recruiterId === userId || company.recruiterId.toString() === userId.toString();
        }

        console.log('📝 Is owner?', isOwner);
        console.log('📝 Is admin?', isAdmin);

        // ✅ Allow admin to bypass ownership check
        if (!isOwner && !isAdmin) {
            console.log('❌ Access denied - User does not own this company');
            return res.status(403).json({
                success: false,
                error: 'You can only update applications for jobs from your company'
            });
        }

        if (isAdmin && !isOwner) {
            console.log('🔐 Admin override - updating application');
        }

        // ✅ Build update data
        const updateData = {
            status: status || application.status,
            recruiterNotes: recruiterNotes || application.recruiterNotes || '',
            updatedAt: new Date()
        };

        // ✅ Add timestamps based on status
        if (status === 'shortlisted') {
            updateData.shortlistedAt = new Date();
        }
        if (status === 'interview' || status === 'interviewing') {
            updateData.interviewAt = new Date();
        }
        if (status === 'hired' || status === 'accepted' || status === 'offered') {
            updateData.hiredAt = new Date();
        }
        if (status === 'rejected') {
            updateData.rejectedAt = new Date();
        }
        if (status === 'reviewed' || status === 'review') {
            updateData.reviewedAt = new Date();
        }

        console.log('📝 Update data:', updateData);

        // ✅ Update the application
        const result = await applicationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Application not found'
            });
        }

        // ✅ Log the action
        await adminLogsCollection.insertOne({
            action: `Application status updated: ${application.applicantName} for "${application.jobTitle}" -> ${status}`,
            adminEmail: req.user?.email || 'Unknown',
            targetUserId: application.applicantId,
            targetJobId: application.jobId,
            targetApplicationId: id,
            createdAt: new Date(),
            type: 'application_status_update',
            adminOverride: isAdmin && !isOwner ? true : false
        });

        console.log(`✅ Application ${id} updated to ${status}`);

        res.json({
            success: true,
            message: `Application ${status} successfully`,
            data: {
                id: id,
                status: status,
                recruiterNotes: recruiterNotes || '',
                updatedAt: updateData.updatedAt
            }
        });
    } catch (error) {
        console.error('❌ [updateApplicationStatusRecruiter] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update application status'
        });
    }
};

// ✅ NEW: Get ALL applications (Admin only)
exports.getAllApplicationsAdmin = async (req, res) => {
    try {
        console.log('🔐🔐🔐 ADMIN getAllApplicationsAdmin called!');
        console.log('👤 Admin:', req.user?.email);
        
        const { applicationsCollection } = getCollections();
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;
        
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