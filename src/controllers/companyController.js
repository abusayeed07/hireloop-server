const { ObjectId } = require('mongodb');
const { getCollections } = require('../lib/dbUtils');

// ✅ Get companies for PUBLIC homepage - ONLY approved companies
exports.getPublicCompanies = async (req, res) => {
    try {
        console.log('📊 [getPublicCompanies] Called');
        const { companiesCollection } = getCollections();
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const industry = req.query.industry || '';

        // ✅ ONLY show approved companies on public page
        let filter = { status: 'approved' };
        
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { industry: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (industry && industry !== 'all') {
            filter.industry = industry;
        }

        const total = await companiesCollection.countDocuments(filter);
        
        const cursor = companiesCollection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const companies = await cursor.toArray();

        res.json({
            success: true,
            data: companies,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('❌ Error fetching public companies:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch companies' 
        });
    }
};

// ✅ Get all companies (Admin only - with pagination and filters)
exports.getAllCompanies = async (req, res) => {
    try {
        console.log('📊 [getAllCompanies] Called');
        const { companiesCollection } = getCollections();
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const industry = req.query.industry || '';

        let filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { recruiterEmail: { $regex: search, $options: 'i' } },
                { industry: { $regex: search, $options: 'i' } }
            ];
        }
        if (status && status !== 'all') {
            filter.status = status;
        }
        if (industry && industry !== 'all') {
            filter.industry = industry;
        }

        const total = await companiesCollection.countDocuments(filter);
        
        const cursor = companiesCollection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const companies = await cursor.toArray();

        res.json({
            success: true,
            data: companies,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('❌ Error fetching companies:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch companies' 
        });
    }
};

// ✅ Get company by ID
exports.getCompanyById = async (req, res) => {
    try {
        console.log('📊 [getCompanyById] Called for ID:', req.params.id);
        const { companiesCollection } = getCollections();
        const id = req.params.id;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid company ID format' 
            });
        }
        
        const result = await companiesCollection.findOne({ _id: new ObjectId(id) });
        
        if (!result) {
            return res.status(404).json({ 
                success: false,
                error: 'Company not found' 
            });
        }
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error fetching company:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch company' 
        });
    }
};

// ✅ Update company status (Admin only)
exports.updateCompanyStatus = async (req, res) => {
    try {
        console.log('📊 [updateCompanyStatus] Called for ID:', req.params.id);
        console.log('📊 Action:', req.body.action);
        console.log('📊 Reason:', req.body.reason); // ✅ Log the reason
        
        const { companiesCollection, adminLogsCollection } = getCollections();
        const { id } = req.params;
        const { action, reason } = req.body; // ✅ Get reason from body

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid company ID'
            });
        }

        const company = await companiesCollection.findOne({ _id: new ObjectId(id) });
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        let updateData = {};
        let message = '';

        switch (action) {
            case 'approve':
                updateData = {
                    status: 'approved',
                    approvedAt: new Date(),
                    updatedAt: new Date()
                };
                message = 'Company approved successfully';
                break;

            case 'reject':
                updateData = {
                    status: 'rejected',
                    rejectedAt: new Date(),
                    updatedAt: new Date(),
                    adminRejectionReason: reason || 'No reason provided' // ✅ Store the rejection reason
                };
                message = 'Company rejected successfully';
                break;

            case 'pending':
                updateData = {
                    status: 'pending',
                    updatedAt: new Date()
                };
                message = 'Company status updated to pending';
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Allowed: approve, reject, pending'
                });
        }

        await companiesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        const updatedCompany = await companiesCollection.findOne({ _id: new ObjectId(id) });

        // ✅ Log the Action
        const adminEmail = req.user?.email || 'Unknown Admin';
        await adminLogsCollection.insertOne({
            action: `Company ${action}d: ${company.name}`,
            adminEmail: adminEmail,
            targetCompanyId: id,
            createdAt: new Date(),
            reason: reason || null // ✅ Log the reason
        });

        res.json({
            success: true,
            message,
            data: updatedCompany
        });

    } catch (error) {
        console.error('❌ Error updating company status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update company status'
        });
    }
};

// ✅ Get my company (for recruiters)
exports.getMyCompany = async (req, res) => {
    try {
        console.log('📊 [getMyCompany] Called for user:', req.user?.id);
        const { companiesCollection } = getCollections();
        const userId = req.user?.id || req.query?.recruiterId;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false,
                error: 'User ID is required' 
            });
        }
        
        const result = await companiesCollection.findOne({ recruiterId: userId });
        console.log('📊 [getMyCompany] Found:', result ? 'Yes' : 'No');
        
        res.json({
            success: true,
            data: result || null
        });
    } catch (error) {
        console.error('❌ Error fetching company:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch company' 
        });
    }
};

// ✅ Create company
exports.createCompany = async (req, res) => {
    try {
        console.log('📥 [createCompany] Called');
        console.log('📥 User:', req.user?.id, req.user?.email);
        console.log('📥 Body:', req.body);
        
        const { companiesCollection, adminLogsCollection } = getCollections();
        const company = req.body;
        
        // ✅ Validate required fields
        if (!company.name || !company.websiteUrl || !company.location) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                error: 'Name, website URL, and location are required'
            });
        }
        
        const newCompany = {
            ...company,
            recruiterId: req.user.id,
            recruiterEmail: req.user.email,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'pending'
        };
        
        console.log('📥 Inserting company:', newCompany.name);
        const result = await companiesCollection.insertOne(newCompany);
        console.log('✅ Company created with ID:', result.insertedId);

        // ✅ Log the Action
        const adminEmail = req.user?.email || 'Unknown Admin';
        await adminLogsCollection.insertOne({
            action: `New Company Registered: ${newCompany.name}`,
            adminEmail: adminEmail,
            targetCompanyId: result.insertedId,
            createdAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Company created successfully',
            insertedId: result.insertedId,
            data: {
                id: result.insertedId,
                ...newCompany
            }
        });
    } catch (error) {
        console.error('❌ [createCompany] Error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create company' 
        });
    }
};

// ✅ Update company
exports.updateCompany = async (req, res) => {
    try {
        console.log('📥 [updateCompany] Called');
        console.log('📥 ID:', req.params.id);
        console.log('📥 User:', req.user?.id);
        console.log('📥 Body:', req.body);
        
        const { companiesCollection } = getCollections();
        const id = req.params.id;
        const updates = req.body;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid company ID format' 
            });
        }
        
        const company = await companiesCollection.findOne({ _id: new ObjectId(id) });
        if (!company) {
            return res.status(404).json({ 
                success: false,
                error: 'Company not found' 
            });
        }
        
        // ✅ Check if user owns this company or is admin
        if (company.recruiterId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                error: 'You can only update your own company' 
            });
        }
        
        // ✅ Remove protected fields
        delete updates._id;
        delete updates.recruiterId;
        delete updates.recruiterEmail;
        delete updates.createdAt;
        
        const result = await companiesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...updates, updatedAt: new Date() } }
        );
        
        console.log('✅ Company updated:', id);
        
        res.json({
            success: true,
            message: 'Company updated successfully'
        });
    } catch (error) {
        console.error('❌ [updateCompany] Error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update company' 
        });
    }
};

// ✅ Delete company (Admin only)
exports.deleteCompany = async (req, res) => {
    try {
        console.log('📥 [deleteCompany] Called for ID:', req.params.id);
        const { companiesCollection, adminLogsCollection } = getCollections();
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid company ID'
            });
        }

        const company = await companiesCollection.findOne({ _id: new ObjectId(id) });
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        await companiesCollection.deleteOne({ _id: new ObjectId(id) });

        // ✅ Log the Action
        const adminEmail = req.user?.email || 'Unknown Admin';
        await adminLogsCollection.insertOne({
            action: `Company Deleted (Permanent): ${company.name}`,
            adminEmail: adminEmail,
            targetCompanyId: id,
            createdAt: new Date()
        });

        console.log('✅ Company deleted:', id);

        res.json({
            success: true,
            message: 'Company deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting company:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete company'
        });
    }
};

// ✅ Get company stats (Admin only)
exports.getCompanyStats = async (req, res) => {
    try {
        console.log('📊 [getCompanyStats] Called');
        const { companiesCollection } = getCollections();
        
        const total = await companiesCollection.countDocuments();
        const pending = await companiesCollection.countDocuments({ status: 'pending' });
        const approved = await companiesCollection.countDocuments({ status: 'approved' });
        const rejected = await companiesCollection.countDocuments({ status: 'rejected' });

        res.json({
            success: true,
            data: {
                total,
                pending,
                approved,
                rejected
            }
        });
    } catch (error) {
        console.error('❌ Error fetching company stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch company stats'
        });
    }
};

// ✅ Request re-review for rejected company
exports.requestReReview = async (req, res) => {
    try {
        console.log('🔄 [requestReReview] Called');
        console.log('📝 Company ID:', req.params.id);
        console.log('👤 Recruiter:', req.user?.email);
        console.log('📝 Message:', req.body.message);
        
        const { companiesCollection, adminLogsCollection } = getCollections();
        const { id } = req.params;
        const { message } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid company ID'
            });
        }

        // ✅ Find the company
        const company = await companiesCollection.findOne({ _id: new ObjectId(id) });
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // ✅ Check if recruiter owns this company
        if (company.recruiterId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You can only request re-review for your own company'
            });
        }

        // ✅ Check if company is rejected
        if (company.status !== 'rejected') {
            return res.status(400).json({
                success: false,
                error: 'Company is not in rejected status. Only rejected companies can request re-review.'
            });
        }

        // ✅ Update company status to pending (for re-review)
        await companiesCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: 'pending',
                    updatedAt: new Date(),
                    reReviewRequestedAt: new Date(),
                    reReviewMessage: message || 'Requesting re-review',
                    reReviewRequestedBy: req.user.email
                }
            }
        );

        const updatedCompany = await companiesCollection.findOne({ _id: new ObjectId(id) });

        // ✅ Log the Action
        await adminLogsCollection.insertOne({
            action: `Re-Review Requested for Company: ${company.name}`,
            adminEmail: req.user?.email || 'Unknown',
            targetCompanyId: id,
            createdAt: new Date(),
            type: 'company_re_review_requested',
            message: message || 'Requesting re-review'
        });

        console.log('✅ Re-review requested for company:', company.name);

        res.json({
            success: true,
            message: 'Re-review request sent successfully! Admin will review your company again.',
            data: updatedCompany
        });

    } catch (error) {
        console.error('❌ [requestReReview] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to request re-review. Please try again.'
        });
    }
};

// ✅ Send message to company (Admin only)
exports.sendMessageToCompany = async (req, res) => {
    try {
        console.log('📝 [sendMessageToCompany] Called');
        console.log('📝 Company ID:', req.params.id);
        console.log('📝 Admin:', req.user?.email);
        console.log('📝 Message:', req.body.message);
        
        const { companiesCollection, adminLogsCollection } = getCollections();
        const { id } = req.params;
        const { message } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid company ID'
            });
        }

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        const company = await companiesCollection.findOne({ _id: new ObjectId(id) });
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // ✅ Update company with message
        await companiesCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    reviewMessage: message.trim(),
                    hasMessage: true,
                    isMessageRead: false,
                    messageUpdatedAt: new Date(),
                    messageSentBy: req.user?.email || 'Admin',
                    messageSentAt: new Date()
                }
            }
        );

        const updatedCompany = await companiesCollection.findOne({ _id: new ObjectId(id) });

        // ✅ Log the Action
        await adminLogsCollection.insertOne({
            action: `Message Sent to Company: ${company.name}`,
            adminEmail: req.user?.email || 'Unknown Admin',
            targetCompanyId: id,
            createdAt: new Date(),
            type: 'company_message_sent',
            message: message.trim()
        });

        console.log('✅ Message sent to company:', company.name);

        res.json({
            success: true,
            message: 'Message sent successfully',
            data: updatedCompany
        });

    } catch (error) {
        console.error('❌ [sendMessageToCompany] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message. Please try again.'
        });
    }
};

// ✅ Mark message as read (Admin only)
exports.markMessageAsRead = async (req, res) => {
    try {
        console.log('📝 [markMessageAsRead] Called');
        console.log('📝 Company ID:', req.params.id);
        console.log('📝 Admin:', req.user?.email);
        
        const { companiesCollection, adminLogsCollection } = getCollections();
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid company ID'
            });
        }

        const company = await companiesCollection.findOne({ _id: new ObjectId(id) });
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // ✅ Mark message as read
        await companiesCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    isMessageRead: true,
                    messageReadAt: new Date(),
                    messageReadBy: req.user?.email || 'Admin'
                }
            }
        );

        const updatedCompany = await companiesCollection.findOne({ _id: new ObjectId(id) });

        // ✅ Log the Action
        await adminLogsCollection.insertOne({
            action: `Message Marked as Read for Company: ${company.name}`,
            adminEmail: req.user?.email || 'Unknown Admin',
            targetCompanyId: id,
            createdAt: new Date(),
            type: 'company_message_read'
        });

        console.log('✅ Message marked as read for company:', company.name);

        res.json({
            success: true,
            message: 'Message marked as read',
            data: updatedCompany
        });

    } catch (error) {
        console.error('❌ [markMessageAsRead] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark message as read. Please try again.'
        });
    }
};

// ✅ Get all messages (Admin only)
exports.getAllMessages = async (req, res) => {
    try {
        console.log('📝 [getAllMessages] Called');
        console.log('📝 Admin:', req.user?.email);
        
        const { companiesCollection } = getCollections();
        
        // ✅ Get all companies that have messages
        const companiesWithMessages = await companiesCollection
            .find({ 
                hasMessage: true,
                reviewMessage: { $exists: true, $ne: null, $ne: '' }
            })
            .sort({ messageUpdatedAt: -1 })
            .toArray();

        const messages = companiesWithMessages.map(company => ({
            companyId: company._id,
            companyName: company.name,
            companyEmail: company.recruiterEmail,
            companyStatus: company.status,
            message: company.reviewMessage,
            isRead: company.isMessageRead || false,
            sentAt: company.messageSentAt || company.messageUpdatedAt || company.updatedAt,
            sentBy: company.messageSentBy || 'Admin'
        }));

        const unreadCount = messages.filter(m => !m.isRead).length;

        res.json({
            success: true,
            data: {
                messages,
                unreadCount,
                total: messages.length
            }
        });

    } catch (error) {
        console.error('❌ [getAllMessages] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get messages. Please try again.'
        });
    }
};

// ✅ Get company by ID for Admin (Admin only)
exports.getAdminCompanyById = async (req, res) => {
    try {
        console.log('🚀🚀🚀 [getAdminCompanyById] CALLED!');
        console.log('📊 Params:', req.params);
        console.log('📊 ID:', req.params.id);
        console.log('👤 Admin:', req.user?.email);
        
        const { companiesCollection } = getCollections();
        const id = req.params.id;
        
        if (!ObjectId.isValid(id)) {
            console.log('❌ Invalid ID format:', id);
            return res.status(400).json({ 
                success: false,
                error: 'Invalid company ID format' 
            });
        }
        
        const result = await companiesCollection.findOne({ _id: new ObjectId(id) });
        
        if (!result) {
            console.log('❌ Company not found:', id);
            return res.status(404).json({ 
                success: false,
                error: 'Company not found' 
            });
        }
        
        console.log('✅ Company found:', result.name);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error fetching company:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch company' 
        });
    }
};

// ✅ ✅ NEW FUNCTION: Get PUBLIC stats (No auth required)
exports.getPublicCompanyStats = async (req, res) => {
    try {
        console.log('📊 [getPublicCompanyStats] Called');
        const { companiesCollection } = getCollections();
        
        const pending = await companiesCollection.countDocuments({ status: 'pending' });
        const approved = await companiesCollection.countDocuments({ status: 'approved' });
        const rejected = await companiesCollection.countDocuments({ status: 'rejected' });

        res.json({
            success: true,
            data: {
                pending,
                approved,
                rejected
            }
        });
    } catch (error) {
        console.error('❌ Error fetching public company stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch company stats'
        });
    }
};