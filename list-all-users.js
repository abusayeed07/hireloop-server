// backend/list-all-users.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function listAllUsers() {
    const client = new MongoClient(process.env.MONGO_DB_URI);
    try {
        await client.connect();
        const db = client.db(process.env.AUTH_DB_NAME || 'hireloop_db');
        const users = db.collection('user');
        
        const allUsers = await users.find({}).toArray();
        
        console.log('\n👥 ALL USERS IN SYSTEM\n');
        console.log(`📊 Total users: ${allUsers.length}\n`);
        
        if (allUsers.length === 0) {
            console.log('❌ No users found in database');
            console.log('💡 Create a user first');
        } else {
            allUsers.forEach((user, index) => {
                console.log(`${index + 1}. 📧 ${user.email}`);
                console.log(`   👤 Name: ${user.name || 'N/A'}`);
                console.log(`   🆔 ID: ${user._id}`);
                console.log(`   ✅ Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
                console.log('');
            });
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
    }
}

listAllUsers();