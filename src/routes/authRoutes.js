// backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { auth } = require('../lib/auth');
const { MongoClient } = require('mongodb');

// ✅ ============================================
// ✅ 1. OAuth CALLBACK ROUTES
// ✅ ============================================

// ✅ Google OAuth Callback
router.get('/api/auth/callback/google', async (req, res) => {
    console.log('🔑 Google OAuth Callback received!');
    console.log('📝 Query params:', req.query);
    console.log('📝 Full URL:', req.originalUrl);
    
    try {
        const instance = await auth.getInstance();
        await instance.handler(req, res);
    } catch (error) {
        console.error('❌ Google callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/signin?error=google_auth_failed`);
    }
});

// ✅ GitHub OAuth Callback
router.get('/api/auth/callback/github', async (req, res) => {
    console.log('🔑 GitHub OAuth Callback received!');
    console.log('📝 Query params:', req.query);
    console.log('📝 Full URL:', req.originalUrl);
    
    try {
        const instance = await auth.getInstance();
        await instance.handler(req, res);
    } catch (error) {
        console.error('❌ GitHub callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/signin?error=github_auth_failed`);
    }
});

// ✅ ============================================
// ✅ 2. CHECK USER ROUTE
// ✅ ============================================

router.post('/check-user', async (req, res) => {
    let client = null;
    try {
        const { email } = req.body;
        console.log('🔍 Checking if user exists:', email);
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email is required' 
            });
        }
        
        client = new MongoClient(process.env.MONGO_DB_URI);
        await client.connect();
        const db = client.db(process.env.AUTH_DB_NAME || 'hireloop_db');
        const users = db.collection('user');
        
        const user = await users.findOne({ email: email });
        
        await client.close();
        
        if (user) {
            console.log('✅ User found:', email);
            res.json({ 
                success: true, 
                exists: true, 
                email: user.email,
                name: user.name 
            });
        } else {
            console.log('❌ User not found:', email);
            res.json({ 
                success: true, 
                exists: false 
            });
        }
    } catch (error) {
        console.error('❌ Error checking user:', error);
        if (client) {
            await client.close();
        }
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ✅ ============================================
// ✅ 3. RESET TOKEN ROUTES
// ✅ ============================================

router.post('/get-reset-token', async (req, res) => {
    let client = null;
    try {
        const { email } = req.body;
        console.log('🔍 Getting reset token for:', email);
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email is required' 
            });
        }
        
        client = new MongoClient(process.env.MONGO_DB_URI);
        await client.connect();
        console.log('✅ MongoDB connected for token retrieval');
        
        const db = client.db(process.env.AUTH_DB_NAME || 'hireloop_db');
        const verification = db.collection('verification');
        const users = db.collection('user');
        
        const user = await users.findOne({ email: email });
        if (!user) {
            console.log('❌ User not found:', email);
            await client.close();
            return res.json({ 
                success: true, 
                token: null,
                message: 'User not found'
            });
        }
        
        console.log('👤 Found user ID:', user._id.toString());
        
        const allTokens = await verification.find({ 
            value: user._id.toString()
        }).sort({ createdAt: -1 }).toArray();
        
        console.log(`📋 Found ${allTokens.length} verification records`);
        
        const resetTokens = allTokens.filter(t => 
            t.identifier && t.identifier.startsWith('reset-password:')
        );
        
        console.log(`🔑 Found ${resetTokens.length} reset tokens`);
        
        if (resetTokens.length === 0) {
            console.log('❌ No reset tokens found for user');
            await client.close();
            return res.json({ 
                success: true, 
                token: null,
                message: 'No reset token found'
            });
        }
        
        const latestToken = resetTokens[0];
        let token = latestToken.identifier;
        if (token.includes(':')) {
            token = token.split(':')[1];
        }
        
        console.log('✅ Token found:', token);
        console.log('📅 Created:', latestToken.createdAt);
        console.log('⏰ Expires:', latestToken.expiresAt);
        
        await client.close();
        
        res.json({ 
            success: true, 
            token: token,
            resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`,
            expiresAt: latestToken.expiresAt,
            createdAt: latestToken.createdAt
        });
        
    } catch (error) {
        console.error('❌ Error getting token:', error);
        if (client) {
            await client.close();
        }
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

router.post('/generate-reset-token', async (req, res) => {
    let client = null;
    try {
        const { email } = req.body;
        console.log('🔍 Generating reset token for:', email);
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email is required' 
            });
        }
        
        const instance = await auth.getInstance();
        const result = await instance.api.requestPasswordReset({
            body: {
                email: email,
                redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`
            }
        });
        console.log('🔄 Generated token result:', result);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        client = new MongoClient(process.env.MONGO_DB_URI);
        await client.connect();
        const db = client.db(process.env.AUTH_DB_NAME || 'hireloop_db');
        const verification = db.collection('verification');
        const users = db.collection('user');
        
        const user = await users.findOne({ email: email });
        if (!user) {
            await client.close();
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        let tokenDoc = null;
        let attempts = 0;
        while (attempts < 5 && !tokenDoc) {
            tokenDoc = await verification.findOne(
                { 
                    value: user._id.toString(),
                    identifier: { $regex: /^reset-password:/ }
                },
                { sort: { createdAt: -1 } }
            );
            if (!tokenDoc) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }
        }
        
        await client.close();
        
        if (tokenDoc) {
            let token = tokenDoc.identifier;
            if (token.includes(':')) {
                token = token.split(':')[1];
            }
            
            console.log('✅ Token generated and found:', token);
            res.json({ 
                success: true, 
                token: token,
                resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`
            });
        } else {
            console.error('❌ Token was generated but not found in database');
            res.json({ 
                success: false, 
                error: 'Token generated but not found in database. Check server logs.'
            });
        }
    } catch (error) {
        console.error('❌ Error generating token:', error);
        if (client) {
            await client.close();
        }
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

router.post('/debug-verification', async (req, res) => {
    let client = null;
    try {
        const { email } = req.body;
        console.log('🔍 Debug verification for:', email || 'all');
        
        client = new MongoClient(process.env.MONGO_DB_URI);
        await client.connect();
        const db = client.db(process.env.AUTH_DB_NAME || 'hireloop_db');
        const verification = db.collection('verification');
        const users = db.collection('user');
        
        let results = [];
        
        if (email) {
            const user = await users.findOne({ email: email });
            if (user) {
                const allEntries = await verification.find({ 
                    value: user._id.toString() 
                }).sort({ createdAt: -1 }).toArray();
                results = allEntries;
            }
        } else {
            results = await verification.find({}).sort({ createdAt: -1 }).limit(20).toArray();
        }
        
        console.log(`📋 Found ${results.length} entries`);
        
        await client.close();
        
        res.json({ 
            success: true, 
            count: results.length,
            entries: results.map(e => ({
                identifier: e.identifier,
                value: e.value,
                expiresAt: e.expiresAt,
                createdAt: e.createdAt
            }))
        });
    } catch (error) {
        console.error('❌ Debug error:', error);
        if (client) await client.close();
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ ============================================
// ✅ 4. CATCH-ALL ROUTE (MUST BE LAST)
// ✅ ============================================

router.use(async (req, res) => {
    try {
        console.log(`🔄 Auth request: ${req.method} ${req.originalUrl}`);
        console.log(`📝 Request body:`, req.body);
        
        const instance = await auth.getInstance();
        
        if (!instance || !instance.handler) {
            console.error('❌ Auth instance or handler is undefined!');
            return res.status(500).json({ 
                success: false, 
                error: 'Auth handler not initialized' 
            });
        }
        
        if (instance.api) {
            console.log(`📋 Available API methods:`, Object.keys(instance.api));
        }
        
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
        const baseURL = `${protocol}://${host}`;
        const fullPath = req.originalUrl || req.url;
        const url = new URL(fullPath, baseURL);

        console.log(`🌐 Full URL: ${url.toString()}`);

        let body = null;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
                body = JSON.stringify(req.body);
                console.log(`📦 Request body stringified:`, body);
            }
        }

        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
                for (const v of value) {
                    headers.append(key, v);
                }
            } else if (value !== undefined) {
                headers.set(key, String(value));
            }
        }

        const webRequest = new Request(url, {
            method: req.method,
            headers: headers,
            body: body,
            duplex: 'half',
        });
        
        console.log(`🚀 Calling Better Auth handler for ${req.method} ${url.pathname}`);
        const webResponse = await instance.handler(webRequest);
        
        console.log(`📦 Response status: ${webResponse.status}`);
        
        let responseData = '';
        try {
            responseData = await webResponse.text();
            console.log(`📦 Response body: ${responseData || '(empty)'}`);
        } catch (e) {
            console.log(`📦 Response body: (could not read)`);
        }
        
        res.status(webResponse.status);
        for (const [key, value] of webResponse.headers) {
            res.setHeader(key, value);
        }
        
        if (responseData) {
            res.send(responseData);
        } else {
            res.end();
        }
    } catch (error) {
        console.error('❌ Auth handler error:', error);
        console.error('❌ Error stack:', error.stack);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
});

module.exports = router;