const { ObjectId } = require('mongodb');
const { getCollections } = require('../lib/dbUtils');

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

exports.createApplication = async (req, res) => {
    try {
        const { applicationsCollection, adminLogsCollection, jobsCollection, usersCollection } = getCollections(); // Added adminLogsCollection
        const application = req.body;
        const newApplication = {
            ...application,
            applicantId: req.user.id,
            createdAt: new Date(),
            status: 'pending'
        };
        const result = await applicationsCollection.insertOne(newApplication);

        // ✅ Log the Action
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