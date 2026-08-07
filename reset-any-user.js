// backend/reset-any-user.js
const axios = require('axios');
const readline = require('readline');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function resetAnyUser() {
    console.log('\n🔐 PASSWORD RESET FOR ANY USER\n');
    
    try {
        // Ask for email
        const email = await prompt('📧 Enter the user email: ');
        
        if (!email) {
            console.log('❌ Email is required');
            rl.close();
            return;
        }
        
        console.log(`\n📧 Requesting password reset for: ${email}`);
        console.log('📤 Sending request...\n');
        
        // Request password reset
        const response = await axios.post(
            `${BASE_URL}/api/auth/forget-password`,
            {
                email: email,
                redirectTo: 'http://localhost:3000/reset-password'
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );
        
        console.log('✅ Password reset requested successfully!');
        console.log('📦 Response:', JSON.stringify(response.data, null, 2));
        console.log('');
        
        // Ask for token
        console.log('📝 Get the reset token:');
        console.log('   🔍 Check the user\'s email inbox');
        console.log('   🔍 Or check server logs');
        console.log('');
        
        const token = await prompt('🔑 Enter the reset token: ');
        
        if (!token) {
            console.log('❌ Token is required');
            rl.close();
            return;
        }
        
        // Get new password
        const newPassword = await prompt('🔑 Enter new password: ');
        
        if (!newPassword || newPassword.length < 8) {
            console.log('❌ Password must be at least 8 characters');
            rl.close();
            return;
        }
        
        // Reset password
        console.log('\n🔄 Resetting password...');
        const resetResponse = await axios.post(
            `${BASE_URL}/api/auth/reset-password`,
            {
                newPassword: newPassword,
                token: token.trim()
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );
        
        console.log('✅ Password reset successful!');
        console.log(`📧 User: ${email}`);
        console.log(`🔑 New Password: ${newPassword}`);
        console.log('');
        
        // Test sign in
        console.log('🔐 Testing sign in...');
        const signInResponse = await axios.post(
            `${BASE_URL}/api/auth/sign-in/email`,
            {
                email: email,
                password: newPassword
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );
        
        console.log('✅ Sign in successful!');
        console.log(`👤 User: ${signInResponse.data.user?.name || email}`);
        console.log('');
        console.log('🎉 Password reset complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        if (error.response?.status === 404) {
            console.log('💡 User not found. Check the email address.');
        }
    }
    
    rl.close();
}

resetAnyUser();