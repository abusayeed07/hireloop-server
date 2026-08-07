const { ObjectId } = require('mongodb');
const { getCollections } = require('../lib/dbUtils');

// ✅ Get companies for PUBLIC homepage - ALL companies (no status filter)
exports.getPublicCompanies = async (req, res) => {
    try {
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
        const { companiesCollection, adminLogsCollection } = getCollections(); // Added adminLogsCollection
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
        const { companiesCollection } = getCollections();
        const userId = req.user?.id || req.query?.recruiterId;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false,
                error: 'User ID is required' 
            });
        }
        
        const result = await companiesCollection.findOne({ recruiterId: userId });
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
        const { companiesCollection, adminLogsCollection } = getCollections(); // Added adminLogsCollection
        const company = req.body;
        
        const newCompany = {
            ...company,
            recruiterId: req.user.id,
            recruiterEmail: req.user.email,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'pending'
        };
        
        const result = await companiesCollection.insertOne(newCompany);

        // ✅ Log the Action
        const adminEmail = req.user?.email || 'Unknown Admin';
        await adminLogsCollection.insertOne({
            action: `New Company Registered: ${newCompany.name}`,
            adminEmail: adminEmail,
            targetCompanyId: result.insertedId,
            createdAt: new Date()
        });

        res.json({
            success: true,
            message: 'Company created successfully',
            data: {
                id: result.insertedId,
                ...newCompany
            }
        });
    } catch (error) {
        console.error('❌ Error creating company:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create company' 
        });
    }
};

// ✅ Update company
exports.updateCompany = async (req, res) => {
    try {
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
        
        if (company.recruiterId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                error: 'You can only update your own company' 
            });
        }
        
        const result = await companiesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...updates, updatedAt: new Date() } }
        );
        
        res.json({
            success: true,
            message: 'Company updated successfully'
        });
    } catch (error) {
        console.error('❌ Error updating company:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update company' 
        });
    }
};

// ✅ Delete company (Admin only)
exports.deleteCompany = async (req, res) => {
    try {
        const { companiesCollection, adminLogsCollection } = getCollections(); // Added adminLogsCollection
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