const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");
const { MongoClient } = require("mongodb");
const { Resend } = require('resend');
const { onUserCreate } = require('../hooks/userHooks');

let authInstance = null;
let client = null;

async function initializeAuth() {
    try {
        console.log('🔄 Initializing Better Auth...');
        
        if (!process.env.MONGO_DB_URI) {
            throw new Error('MONGO_DB_URI environment variable is not set');
        }
        
        client = new MongoClient(process.env.MONGO_DB_URI, {
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 10000,
        });
        
        await client.connect();
        console.log('✅ MongoDB client connected for auth');
        
        const db = client.db(process.env.AUTH_DB_NAME || "hireloop_db");
        console.log(`✅ Database selected: ${db.databaseName}`);
        
        // Ensure collections exist
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        const required = ['user', 'session', 'account', 'verification'];
        
        for (const coll of required) {
            if (!collectionNames.includes(coll)) {
                await db.createCollection(coll);
                console.log(`✅ Created collection: ${coll}`);
            }
        }
        
        const adapter = mongodbAdapter(db, { client });
        console.log('✅ MongoDB adapter created');

        let resend = null;
        if (process.env.RESEND_API_KEY) {
            resend = new Resend(process.env.RESEND_API_KEY);
            console.log('✅ Resend initialized');
        } else {
            console.warn('⚠️ RESEND_API_KEY not set - email sending disabled');
        }

        // ✅ Create auth instance with proper defaults
        authInstance = betterAuth({
            baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5000',
            secret: process.env.BETTER_AUTH_SECRET,
            database: adapter,
            
            trustedOrigins: [
                process.env.FRONTEND_URL || 'http://localhost:3000',
                'http://localhost:5000'
            ],
            
            // ✅ Add session configuration to include custom fields
            session: {
                fields: {
                    id: true,
                    email: true,
                    name: true,
                    image: true,
                    emailVerified: true,
                    role: true,
                    plan: true,
                    phone: true,
                    status: true,
                    suspendedAt: true,
                }
            },
            
            emailAndPassword: {
                enabled: true,
                sendResetPassword: async ({ user, url, token }) => {
                    console.log(`📧 Sending reset password email to ${user.email}`);
                    console.log(`🔗 Reset URL: ${url}`);
                    
                    if (!resend) {
                        console.warn('⚠️ Resend not configured - skipping email');
                        console.log(`📝 Reset link (dev): ${url}`);
                        return;
                    }
                    
                    try {
                        const { data, error } = await resend.emails.send({
                            from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
                            to: user.email,
                            subject: "Reset Your Password - HireLoop",
                            html: `<!DOCTYPE html>
                                <html>
                                    <head>
                                        <meta charset="utf-8">
                                        <style>
                                            body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; margin: 0; }
                                            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                                            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
                                            .header h1 { color: #1a1a2e; margin: 0; }
                                            .header span { color: #3b82f6; }
                                            .content { padding: 20px 0; }
                                            .button { display: inline-block; padding: 14px 28px; background-color: #3b82f6; color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
                                            .button:hover { background-color: #2563eb; }
                                            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
                                            .link-box { background: #f3f4f6; padding: 12px; border-radius: 4px; word-break: break-all; margin: 10px 0; }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="container">
                                            <div class="header">
                                                <h1>Hire<span>Loop</span></h1>
                                                <p style="color: #6b7280;">Password Reset</p>
                                            </div>
                                            <div class="content">
                                                <p>Hello ${user.name || 'User'},</p>
                                                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                                                <div style="text-align: center;">
                                                    <a href="${url}" class="button">Reset Password</a>
                                                </div>
                                                <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
                                                <div class="link-box">
                                                    <a href="${url}" style="color: #3b82f6; text-decoration: none;">${url}</a>
                                                </div>
                                                <p style="color: #6b7280; font-size: 14px;">This link will expire in <strong>1 hour</strong>.</p>
                                                <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                                            </div>
                                            <div class="footer">
                                                <p>© ${new Date().getFullYear()} HireLoop. All rights reserved.</p>
                                            </div>
                                        </div>
                                    </html>`,
                            text: `Reset your password by clicking this link: ${url}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`
                        });

                        if (error) {
                            console.error('❌ Resend error:', error);
                            throw new Error(error.message);
                        }

                        console.log(`✅ Reset password email sent to ${user.email}`);
                    } catch (error) {
                        console.error("❌ Failed to send reset password email:", error);
                    }
                },
                resetPasswordTokenExpiresIn: 60 * 60,
            },

            // ✅ FIXED: Remove hooks entirely - they're causing the error
            // Just comment out or remove the hooks block

            socialProviders: {
                google: {
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    mapProfileToUser: (profile) => {
                        console.log('📝 Mapping Google profile to user:', profile.email);
                        return {
                            email: profile.email,
                            name: profile.name || profile.given_name || profile.email.split('@')[0],
                            role: "seeker",
                            plan: "seeker_free",
                            status: "active",
                            image: profile.picture || null,
                            emailVerified: true,
                        };
                    },
                },
                github: {
                    clientId: process.env.GITHUB_CLIENT_ID,
                    clientSecret: process.env.GITHUB_CLIENT_SECRET,
                    mapProfileToUser: (profile) => {
                        console.log('📝 Mapping GitHub profile to user:', profile.email);
                        return {
                            email: profile.email,
                            name: profile.name || profile.login || profile.email?.split('@')[0] || 'GitHub User',
                            role: "seeker",
                            plan: "seeker_free",
                            status: "active",
                            image: profile.avatar_url || null,
                            emailVerified: true,
                        };
                    },
                },
            },

            // ✅ User schema with all fields including status
            user: {
                additionalFields: {
                    role: { 
                        type: "string", 
                        default: "seeker", 
                        required: true 
                    },
                    plan: { 
                        type: "string", 
                        default: "seeker_free" 
                    },
                    phone: { 
                        type: "string", 
                        default: "" 
                    },
                    status: {
                        type: "string", 
                        default: "active",
                        required: true
                    },
                    suspendedAt: {
                        type: "date", 
                        default: null
                    },
                },
            },

            advanced: {
                cookiePrefix: "better-auth",
                useSecureCookies: process.env.NODE_ENV === 'production',
                crossSubDomainCookies: {
                    enabled: true,
                    domain: process.env.NODE_ENV === 'production' ? '.yourdomain.com' : 'localhost',
                },
                debug: process.env.NODE_ENV !== 'production',
            },
        });

        console.log("✅ Better Auth initialized successfully");
        return authInstance;
    } catch (error) {
        console.error("❌ Auth initialization failed:", error);
        throw error;
    }
}

// Initialize immediately
const authPromise = initializeAuth();

module.exports = {
    auth: {
        getInstance: async () => {
            if (!authInstance) {
                authInstance = await authPromise;
            }
            return authInstance;
        },
        api: {
            getSession: async ({ headers, asResponse = false }) => {
                const instance = await authInstance || await authPromise;
                return instance.api.getSession({ headers, asResponse });
            },
            signInEmail: async ({ body, headers, asResponse = false }) => {
                const instance = await authInstance || await authPromise;
                return instance.api.signInEmail({ body, headers, asResponse });
            },
            signOut: async ({ headers, asResponse = false }) => {
                const instance = await authInstance || await authPromise;
                return instance.api.signOut({ headers, asResponse });
            }
        }
    }
};