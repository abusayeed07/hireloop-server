// backend/src/middleware/authMiddleware.js
const { auth } = require('../lib/auth');
const { getCollections } = require('../lib/dbUtils');
const { ObjectId } = require('mongodb');

// Helper function to safely forward multiple Set-Cookie headers
const safelyForwardCookies = (sourceResponse, targetResponse) => {
    if (targetResponse.headersSent) return;
    
    const setCookieHeader = sourceResponse.headers.get('set-cookie');
    if (setCookieHeader) {
        const cookies = setCookieHeader.split(/,(?=[^;]*=)/);
        cookies.forEach(cookie => {
            targetResponse.append('Set-Cookie', cookie.trim());
        });
    }
};

const authMiddleware = async (req, res, next) => {
    try {
        const response = await auth.api.getSession({
            headers: req.headers,
            asResponse: true,
        });

        if (response instanceof Response) {
            const clonedResponse = response.clone();
            const sessionData = await clonedResponse.json();
            
            safelyForwardCookies(response, res);
            req.user = sessionData?.user || null;
            
            if (req.user) {
                console.log(`🔐 Auth middleware - User: ${req.user.email}, Role: ${req.user.role || 'seeker'}`);
            }
        } else {
            req.user = response?.user || null;
        }
        
        next();
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        req.user = null;
        next();
    }
};

const requireAuth = async (req, res, next) => {
    try {
        const response = await auth.api.getSession({
            headers: req.headers,
            asResponse: true,
        });

        if (response instanceof Response) {
            const clonedResponse = response.clone();
            const sessionData = await clonedResponse.json();
            
            if (!sessionData?.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }
            
            safelyForwardCookies(response, res);
            req.user = sessionData.user;
            
            console.log(`🔐 RequireAuth - User: ${req.user.email}, Role: ${req.user.role || 'seeker'}`);
        } else {
            if (!response?.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }
            req.user = response.user;
        }
        
        next();
    } catch (error) {
        console.error('❌ Auth error:', error);
        return res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

// ✅ Check if user is suspended
const requireActive = async (req, res, next) => {
    try {
        // ✅ Get user ID from req.user
        const userId = req.user?.id || req.user?._id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        
        // ✅ Check user status in database
        const { usersCollection } = getCollections();
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // ✅ If user is suspended, block access
        if (user.status === 'suspended') {
            console.log(`🚫 Suspended user attempted access: ${user.email}`);
            
            // ✅ Try to revoke session
            try {
                await auth.api.revokeSession({
                    headers: req.headers,
                    body: { sessionId: req.session?.id }
                });
            } catch (err) {
                // Session might already be gone
                console.log('Could not revoke session:', err.message);
            }
            
            return res.status(403).json({
                success: false,
                error: 'Your account has been suspended. Please contact support.',
                code: 'ACCOUNT_SUSPENDED'
            });
        }
        
        // ✅ Attach fresh user data to request
        req.user = {
            ...req.user,
            status: user.status || 'active',
            suspendedAt: user.suspendedAt,
            role: user.role || 'seeker',
            plan: user.plan || 'seeker_free'
        };
        
        console.log(`✅ Active user: ${user.email}, Status: ${user.status || 'active'}`);
        next();
        
    } catch (error) {
        console.error('❌ Active check error:', error);
        return res.status(500).json({
            success: false,
            error: 'Error checking account status'
        });
    }
};

// ✅ Role-based middleware
const requireRole = (roles) => {
    return async (req, res, next) => {
        try {
            const userRole = req.user?.role?.toLowerCase() || 'seeker';
            const allowedRoles = roles.map(r => r.toLowerCase());
            
            if (!allowedRoles.includes(userRole)) {
                console.log(`❌ Access denied - User role: ${userRole}, Required: ${allowedRoles.join(', ')}`);
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Insufficient permissions.'
                });
            }
            
            console.log(`✅ Access granted - User role: ${userRole}`);
            next();
        } catch (error) {
            console.error('❌ Role check error:', error);
            return res.status(500).json({
                success: false,
                error: 'Error checking permissions'
            });
        }
    };
};

module.exports = { authMiddleware, requireAuth, requireActive, requireRole };