// backend/test-password-reset-auto.js
const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.BETTER_AUTH_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ✅ TEST DATA - CHANGE THESE
const TEST_EMAIL = 'test@example.com'; // Use a real email for testing
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';

console.log('\n🧪 AUTOMATED PASSWORD RESET TEST\n');
console.log('📋 Configuration:');
console.log(`   Backend URL: ${BASE_URL}`);
console.log(`   Test Email: ${TEST_EMAIL}`);
console.log('');

// Helper to extract token from URL
function extractTokenFromUrl(url) {
    const match = url.match(/[?&]token=([^&]+)/);
    return match ? match[1] : null;
}

async function runAutomatedTest() {
    let resetToken = null;
    
    try {
        // ========================================
        // STEP 1: Check if user exists, if not create one
        // ========================================
        console.log('👤 STEP 1: Checking/Creating test user...');
        
        let userExists = false;
        try {
            // Try to sign in to check if user exists
            await axios.post(
                `${BASE_URL}/api/auth/sign-in/email`,
                {
                    email: TEST_EMAIL,
                    password: TEST_PASSWORD
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 5000
                }
            );
            userExists = true;
            console.log('✅ User already exists');
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 404) {
                console.log('📝 User not found, creating new user...');
                
                try {
                    const signUpResponse = await axios.post(
                        `${BASE_URL}/api/auth/sign-up/email`,
                        {
                            email: TEST_EMAIL,
                            password: TEST_PASSWORD,
                            name: TEST_NAME
                        },
                        {
                            headers: { 'Content-Type': 'application/json' },
                            timeout: 10000
                        }
                    );
                    
                    console.log('✅ User created successfully!');
                    userExists = true;
                } catch (signUpError) {
                    console.log('⚠️ Could not create user, but continuing with password reset test...');
                }
            }
        }
        console.log('');

        // ========================================
        // STEP 2: Request Password Reset
        // ========================================
        console.log('📧 STEP 2: Requesting password reset...');
        
        const forgetResponse = await axios.post(
            `${BASE_URL}/api/auth/forget-password`,
            {
                email: TEST_EMAIL,
                redirectTo: `${FRONTEND_URL}/reset-password`
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );
        
        console.log('✅ Password reset requested successfully!');
        console.log('📦 Response:', JSON.stringify(forgetResponse.data, null, 2));
        console.log('');

        // ========================================
        // STEP 3: Extract token from email (mock for testing)
        // ========================================
        console.log('🔑 STEP 3: Waiting for token...');
        console.log('   💡 In production, the token is sent via email');
        console.log('   📝 For testing, we\'ll check the database or logs');
        console.log('');

        // Wait a moment for the email to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ========================================
        // STEP 4: Get token from database directly
        // ========================================
        console.log('🔍 STEP 4: Retrieving token from database...');
        
        // Since we can't get the token from email automatically,
        // we'll check if the token is in the database
        // This requires connecting to MongoDB directly
        
        const { MongoClient } = require('mongodb');
        const client = new MongoClient(process.env.MONGO_DB_URI);
        
        try {
            await client.connect();
            console.log('✅ Connected to MongoDB');
            
            const db = client.db(process.env.AUTH_DB_NAME || 'hireloop_db');
            const verificationCollection = db.collection('verification');
            
            // Find the most recent verification token for this email
            const verification = await verificationCollection.findOne(
                { 
                    identifier: TEST_EMAIL,
                    type: 'reset-password'
                },
                { 
                    sort: { createdAt: -1 } 
                }
            );
            
            if (verification) {
                resetToken = verification.token;
                console.log('✅ Token found in database!');
                console.log(`📝 Token: ${resetToken.substring(0, 15)}...`);
            } else {
                console.log('⚠️ No token found in database');
                console.log('💡 Please check your email and enter the token manually');
                
                // Fallback: ask for token manually
                const readline = require('readline').createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                
                resetToken = await new Promise((resolve) => {
                    readline.question('📝 Enter the reset token from email/logs: ', (answer) => {
                        resolve(answer.trim());
                        readline.close();
                    });
                });
            }
        } catch (dbError) {
            console.log('⚠️ Could not access database:', dbError.message);
            console.log('💡 Please enter the token manually');
            
            // Fallback: ask for token manually
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            resetToken = await new Promise((resolve) => {
                readline.question('📝 Enter the reset token from email/logs: ', (answer) => {
                    resolve(answer.trim());
                    readline.close();
                });
            });
        } finally {
            await client.close();
        }

        if (!resetToken) {
            console.log('❌ No token provided. Test cancelled.');
            return;
        }

        console.log(`✅ Token received: ${resetToken.substring(0, 15)}...`);
        console.log('');

        // ========================================
        // STEP 5: Reset Password
        // ========================================
        console.log('🔐 STEP 5: Resetting password...');
        
        const resetResponse = await axios.post(
            `${BASE_URL}/api/auth/reset-password`,
            {
                newPassword: TEST_PASSWORD,
                token: resetToken
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );
        
        console.log('✅ Password reset successfully!');
        console.log('📦 Response:', JSON.stringify(resetResponse.data, null, 2));
        console.log('');

        // ========================================
        // STEP 6: Verify Sign In with New Password
        // ========================================
        console.log('🔑 STEP 6: Verifying sign in with new password...');
        
        const signInResponse = await axios.post(
            `${BASE_URL}/api/auth/sign-in/email`,
            {
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );
        
        console.log('✅ Sign in successful!');
        console.log('📦 User:', JSON.stringify(signInResponse.data.user, null, 2));
        console.log('');

        // ========================================
        // STEP 7: Get Session
        // ========================================
        console.log('👤 STEP 7: Getting session...');
        
        const sessionResponse = await axios.get(
            `${BASE_URL}/api/auth/session`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': signInResponse.headers['set-cookie']?.join('; ') || ''
                },
                timeout: 10000
            }
        );
        
        console.log('✅ Session retrieved!');
        console.log('📦 Session:', JSON.stringify(sessionResponse.data, null, 2));
        console.log('');

        console.log('🎉 ALL TESTS PASSED! Password reset flow is working correctly.');
        console.log(`✅ User: ${TEST_EMAIL}`);
        console.log(`✅ Password: ${TEST_PASSWORD}`);
        console.log('');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.response) {
            console.error('📦 Response status:', error.response.status);
            console.error('📦 Response data:', JSON.stringify(error.response.data, null, 2));
        }
        
        console.log('');
        console.log('💡 Troubleshooting tips:');
        console.log('   1. Make sure your backend server is running on port 5000');
        console.log('   2. Check that MongoDB is connected');
        console.log('   3. Verify RESEND_API_KEY is valid (or check logs for token)');
        console.log('   4. Try using a real email address for testing');
        console.log('   5. Check if the verification collection exists in MongoDB');
        console.log('');
    }
}

// Run the automated test
runAutomatedTest();