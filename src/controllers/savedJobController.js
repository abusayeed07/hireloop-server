const { ObjectId } = require('mongodb');
const { getCollections } = require('../lib/dbUtils');

exports.saveJob = async (req, res) => {
    console.log('📝 SAVE JOB REQUEST RECEIVED');
    
    try {
        const { savedJobsCollection, jobsCollection } = getCollections();
        const { jobId } = req.body;
        
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }
        
        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid job ID format' 
            });
        }
        
        // Check if job exists
        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });
        if (!job) {
            return res.status(404).json({ 
                success: false, 
                error: 'Job not found' 
            });
        }
        
        if (job.status !== 'active') {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot save inactive job' 
            });
        }
        
        // Check if already saved
        const existingSave = await savedJobsCollection.findOne({
            userId: userId,
            jobId: jobId
        });
        
        if (existingSave) {
            return res.status(400).json({ 
                success: false, 
                error: 'Job already saved' 
            });
        }
        
        // Create saved job entry
        const savedJob = {
            userId: userId,
            jobId: jobId,
            savedAt: new Date(),
            jobSnapshot: {
                jobTitle: job.jobTitle,
                companyName: job.companyName,
                companyLogo: job.companyLogo || job.jobsLogo,
                location: job.location,
                jobType: job.jobType,
                minSalary: job.minSalary,
                maxSalary: job.maxSalary,
                currency: job.currency,
                jobCategory: job.jobCategory,
                isRemote: job.isRemote,
                experienceLevel: job.experienceLevel,
                jobsLogo: job.jobsLogo,
                postedAt: job.postedAt
            }
        };
        
        const result = await savedJobsCollection.insertOne(savedJob);
        console.log('✅ Insert successful! InsertedId:', result.insertedId);
        
        res.status(201).json({
            success: true,
            message: 'Job saved successfully',
            savedJobId: result.insertedId
        });
    } catch (error) {
        console.error('❌ Error saving job:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to save job' 
        });
    }
};

exports.unsaveJob = async (req, res) => {
    console.log('📝 UNSAVE JOB REQUEST RECEIVED');
    
    try {
        const { savedJobsCollection } = getCollections();
        const { jobId } = req.params;
        
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }
        
        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid job ID' 
            });
        }
        
        const result = await savedJobsCollection.deleteOne({
            userId: userId,
            jobId: jobId
        });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Saved job not found' 
            });
        }
        
        console.log('✅ Job unsaved successfully!');
        res.json({
            success: true,
            message: 'Job removed from saved'
        });
    } catch (error) {
        console.error('❌ Error unsaving job:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to remove saved job' 
        });
    }
};

exports.checkSavedStatus = async (req, res) => {
    try {
        const { savedJobsCollection } = getCollections();
        const { jobId } = req.params;
        
        const userId = req.user?.id || req.query?.userId;
        
        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid job ID' 
            });
        }
        
        if (!userId) {
            return res.json({ saved: false, savedAt: null });
        }
        
        const saved = await savedJobsCollection.findOne({
            userId: userId,
            jobId: jobId
        });
        
        res.json({
            saved: !!saved,
            savedAt: saved?.savedAt || null
        });
    } catch (error) {
        console.error('Error checking saved status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to check saved status' 
        });
    }
};

exports.getSavedJobs = async (req, res) => {
    try {
        const { savedJobsCollection, jobsCollection } = getCollections();
        
        const userId = req.user?.id || req.query?.userId;
        
        console.log('📝 Get Saved Jobs for user:', userId);
        
        if (!userId) {
            return res.json([]);
        }
        
        const savedEntries = await savedJobsCollection
            .find({ userId: userId })
            .sort({ savedAt: -1 })
            .toArray();
        
        if (savedEntries.length === 0) {
            return res.json([]);
        }
        
        const jobIds = savedEntries.map(entry => new ObjectId(entry.jobId));
        const jobs = await jobsCollection
            .find({ 
                _id: { $in: jobIds },
                status: 'active'
            })
            .toArray();
        
        const jobMap = {};
        jobs.forEach(job => {
            jobMap[job._id.toString()] = job;
        });
        
        const savedJobs = savedEntries
            .map(entry => {
                const job = jobMap[entry.jobId];
                if (!job) return null;
                return {
                    ...job,
                    savedAt: entry.savedAt,
                    savedId: entry._id
                };
            })
            .filter(job => job !== null);
        
        res.json(savedJobs);
    } catch (error) {
        console.error('Error fetching saved jobs:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch saved jobs' 
        });
    }
};

exports.getSavedJobIds = async (req, res) => {
    try {
        const { savedJobsCollection } = getCollections();
        const userId = req.user?.id || req.query?.userId;
        
        if (!userId) {
            return res.json({ savedJobIds: [] });
        }
        
        const savedEntries = await savedJobsCollection
            .find({ userId: userId })
            .project({ jobId: 1 })
            .toArray();
        
        const jobIds = savedEntries.map(entry => entry.jobId);
        res.json({ savedJobIds: jobIds });
    } catch (error) {
        console.error('Error fetching saved job IDs:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch saved job IDs' 
        });
    }
};