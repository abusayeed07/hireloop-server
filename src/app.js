// backend/src/app.js
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require('dotenv').config();

console.log('\n🔍 Environment Check:');
console.log('📁 Current directory:', __dirname);
console.log('🔑 MONGO_DB_URI exists:', !!process.env.MONGO_DB_URI);
console.log('🔑 PORT:', process.env.PORT || 5000);
console.log('🔑 BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL || 'Not set');
console.log('🔑 FRONTEND_URL:', process.env.FRONTEND_URL || 'http://localhost:3000');
console.log('🔑 RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
console.log('');

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { connectDB, getDB } = require('./config/db');
const { auth } = require('./lib/auth');

// ✅ Import Routes
const userRoutes = require('./routes/userRoutes');
const jobRoutes = require('./routes/jobRoutes');
const companyRoutes = require('./routes/companyRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const planRoutes = require('./routes/planRoutes');
const billingRoutes = require('./routes/billingRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const savedJobRoutes = require('./routes/savedJobRoutes');
const deleteAccountRoutes = require('./routes/deleteAccountRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { authMiddleware } = require("./middleware/authMiddleware");

const app = express();

// ✅ Global Error Handlers
process.on('uncaughtException', (error) => {
    console.error('❌ UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION:', reason);
});

// ✅ CORS Middleware - FIXED with PATCH method
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Cache-Control', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
}));

// ✅ REMOVED: app.options('*', cors()) - This was causing the crash

app.use(express.json());
app.use(cookieParser());

// ✅ Request Logger
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url}`);
    next();
});

// ✅ 🔐 Apply authMiddleware GLOBALLY
app.use(authMiddleware);

// ✅ 🚀 Better Auth routes
app.use('/api/auth', authRoutes);

// ✅ Health Check & Public Routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'HireLoop Backend Server Running!',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            test: '/api/test',
            auth: '/api/auth',
            jobs: '/api/jobs',
            companies: '/api/companies',
            applications: '/api/applications',
            plans: '/api/plans',
            billing: '/api/billing',
            'saved-jobs': '/api/saved-jobs',
            debug: '/api/debug'
        }
    });
});

app.get('/api/test', async (req, res) => {
    try {
        const db = getDB();
        const collections = await db.listCollections().toArray();
        
        res.json({
            success: true,
            message: 'Server is running!',
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                collections: collections.map(c => c.name)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ Debug: Check collections
app.get('/api/debug/collections', async (req, res) => {
    try {
        const db = getDB();
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        const required = ['user', 'session', 'account', 'verification'];
        const missing = required.filter(c => !collectionNames.includes(c));
        
        res.json({
            success: true,
            collections: collectionNames,
            missingCollections: missing,
            hasAllRequired: missing.length === 0,
            requiredCollections: required
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Debug: Create missing collections
app.post('/api/debug/create-collections', async (req, res) => {
    try {
        const db = getDB();
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        const required = ['user', 'session', 'account', 'verification'];
        const created = [];
        const alreadyExist = [];
        
        for (const coll of required) {
            if (!collectionNames.includes(coll)) {
                try {
                    await db.createCollection(coll);
                    created.push(coll);
                    console.log(`✅ Created collection: ${coll}`);
                } catch (err) {
                    console.log(`Could not create ${coll}:`, err.message);
                }
            } else {
                alreadyExist.push(coll);
            }
        }
        
        res.json({
            success: true,
            created: created,
            alreadyExist: alreadyExist,
            collections: await db.listCollections().toArray()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ API Routes
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api', checkoutRoutes);
app.use('/api/saved-jobs', savedJobRoutes);
app.use('/api', deleteAccountRoutes);
app.use('/api', adminRoutes); 

// ✅ 404 Handler
app.use((req, res) => {
    console.log(`❌ 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.url
    });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Global error:', err);
    console.error('❌ Stack:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error',
    });
});

const port = process.env.PORT || 5000;

async function startServer() {
    try {
        await connectDB();
        await auth.getInstance();
        console.log('✅ Auth instance ready');
        
        app.listen(port, () => {
            console.log(`\n🚀 Server running on port ${port}`);
            console.log(`📋 Health: http://localhost:${port}/api/health`);
            console.log(`📋 Test: http://localhost:${port}/api/test`);
            console.log(`📋 Auth: http://localhost:${port}/api/auth`);
            console.log(`📋 Debug Collections: http://localhost:${port}/api/debug/collections`);
            console.log(`\n✨ Ready to accept requests!\n`);
        });
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

startServer();