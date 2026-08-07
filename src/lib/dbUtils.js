const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

// ✅ Make sure this is exported correctly
const getCollections = () => {
    try {
        const db = getDB();
        if (!db) {
            throw new Error('Database not initialized');
        }
        
        return {
            // ✅ Better Auth collections
            user: db.collection("user"),
            session: db.collection("session"),
            account: db.collection("account"),
            verification: db.collection("verification"),
            
            // ✅ Your application collections
            applicationsCollection: db.collection("applications"),
            billingHistoryCollection: db.collection("billing_history"),
            companiesCollection: db.collection("companies"),
            jobsCollection: db.collection("jobs"),
            plansCollection: db.collection("plans"),
            savedJobsCollection: db.collection("saved_jobs"),
            paymentMethodsCollection: db.collection("payment_methods"),
            
            // ✅ Aliases for backward compatibility
            usersCollection: db.collection("user"),
            sessionCollection: db.collection("session"),
            subscriptionCollection: db.collection("subscriptions"),
            
            // ✅ ADDED: Collections for Admin Settings
            adminLogsCollection: db.collection("adminLogs"),
            settingsCollection: db.collection("settings"),
        };
    } catch (error) {
        console.error('❌ Error getting collections:', error);
        throw error;
    }
};

const toObjectId = (id) => {
    try {
        if (!id) return null;
        if (typeof id === 'string' && ObjectId.isValid(id)) {
            return new ObjectId(id);
        }
        if (id instanceof ObjectId) {
            return id;
        }
        return null;
    } catch (error) {
        console.error('❌ Error converting to ObjectId:', error);
        return null;
    }
};

// ✅ Export both functions
module.exports = { getCollections, toObjectId, ObjectId };