// backend/src/scripts/addDynamicCard.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function addDynamicCard() {
    const client = new MongoClient(process.env.MONGO_DB_URI);
    try {
        await client.connect();
        const db = client.db(process.env.AUTH_DB_NAME || "hireloop_db");
        const usersCollection = db.collection("user");
        const paymentMethods = db.collection("payment_methods");

        // ✅ DYNAMIC: Find the first user in the database. 
        // If you want to target a specific email, you can still change this line!
        const user = await usersCollection.findOne(); 

        if (!user) {
            console.log("❌ No users found in the database.");
            return;
        }

        console.log(`✅ Found user: ${user.email} (${user.name || 'Unnamed'})`);

        // Remove any old cards for this user so we don't get duplicates
        await paymentMethods.deleteMany({ email: user.email });

        const dynamicCard = {
            email: user.email,
            brand: "VISA",
            last4: "4242",
            expiryMonth: "12",
            expiryYear: "27",
            cardholderName: user.name ? user.name.toUpperCase() : "CARD HOLDER",
            isDefault: true,
            createdAt: new Date()
        };

        await paymentMethods.insertOne(dynamicCard);
        console.log(`✅ Dynamic VISA card added for ${user.email} (Cardholder: ${dynamicCard.cardholderName})`);
        
    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await client.close();
    }
}

addDynamicCard();