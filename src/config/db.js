// backend/src/config/db.js
const { MongoClient } = require('mongodb');

let db = null;
let client = null;

const connectDB = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        
        if (!process.env.MONGO_DB_URI) {
            throw new Error('MONGO_DB_URI environment variable is not set');
        }
        
        client = new MongoClient(process.env.MONGO_DB_URI, {
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 10000,
        });
        
        await client.connect();
        console.log('✅ MongoDB client connected');
        
        db = client.db(process.env.AUTH_DB_NAME || "hireloop_db");
        console.log(`✅ Database selected: ${db.databaseName}`);
        
        // ✅ Test connection
        await db.command({ ping: 1 });
        console.log('✅ Database connection verified');
        
        return db;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
};

const getDB = () => {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB() first.');
    }
    return db;
};

const closeDB = async () => {
    try {
        if (client) {
            await client.close();
            console.log('✅ Database connection closed');
        }
    } catch (error) {
        console.error('❌ Error closing database:', error);
    }
};

module.exports = { connectDB, getDB, closeDB };