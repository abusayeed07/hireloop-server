const { ObjectId } = require('mongodb');
const { getCollections } = require('../lib/dbUtils');

// ✅ Get companies for PUBLIC homepage - ALL companies (no status filter)
exports.getPublicCompanies = async (req, res) => {
    try {
        console.log('📊 [getPublicCompanies] Called');
        const { companiesCollection } = getCollections();
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const industry = req.query.industry || '';

        let filter = {};
        
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
        
        const { companiesCollection, adminLogsCollection } = getCollections();
        const { id } = req.params;
        const { action } = req.body;

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
                    updatedAt: new Date()
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
            createdAt: new Date()
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