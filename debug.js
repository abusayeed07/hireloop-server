// backend/debug.js
const fs = require('fs');
const path = require('path');

console.log('\n🔍 DEBUGGING INFORMATION\n');

// ✅ Check file structure
console.log('📁 Current directory:', __dirname);
console.log('📁 Files in directory:', fs.readdirSync(__dirname));

// ✅ Check environment
console.log('\n🔑 Environment variables:');
console.log('MONGO_DB_URI exists:', !!process.env.MONGO_DB_URI);
console.log('BETTER_AUTH_SECRET exists:', !!process.env.BETTER_AUTH_SECRET);
console.log('STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY);

// ✅ Check node version
console.log('\n🟢 Node version:', process.version);
console.log('🟢 Platform:', process.platform);

// ✅ Test module resolution
console.log('\n📦 Testing module resolution:');
try {
    const testPath = path.join(__dirname, 'src', 'app.js');
    console.log('app.js path:', testPath);
    console.log('app.js exists:', fs.existsSync(testPath));
} catch (error) {
    console.error('Error checking paths:', error.message);
}

console.log('\n✅ Debug info complete\n');