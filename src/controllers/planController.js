// backend/src/controllers/planController.js
const { getCollections } = require('../lib/dbUtils');

exports.getAllPlans = async (req, res) => {
    try {
        const { plansCollection } = getCollections();
        const query = {};
        
        if (req.query.plan_id) {
            query.id = req.query.plan_id;
            const result = await plansCollection.findOne(query);
            return res.send(result);
        }
        
        const result = await plansCollection.find(query).toArray();
        res.send(result);
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
};