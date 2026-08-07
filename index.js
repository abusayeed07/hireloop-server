// // server.js - Complete version
// const dns = require("node:dns");
// dns.setServers(["8.8.8.8", "8.8.4.4"]);

// const express = require('express')
// const cors = require('cors')
// const app = express()
// require('dotenv').config()

// app.use(cors())
// app.use(express.json())

// const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// app.get('/', (req, res) => {
//     res.send('Hello World!')
// })

// const uri = process.env.MONGO_DB_URI;
// const port = process.env.PORT || 5000

// const client = new MongoClient(uri, {
//     serverApi: {
//         version: ServerApiVersion.v1,
//         strict: true,
//         deprecationErrors: true,
//     }
// });

// async function run() {
//     try {
//         await client.connect();
//         console.log("✅ Connected to MongoDB!");

//         const db = client.db("hireloop_db");
//         const jobCollection = db.collection("jobs");
//         const companyCollection = db.collection("companies")
//         const usersCollection = db.collection("user")
//         const jobApplicationCollection = db.collection("applications")
//         const planCollection = db.collection("plans")
//         const subscriptionCollection = db.collection("subscriptions")
//         const billingHistoryCollection = db.collection("billing_history")
//         const paymentMethodsCollection = db.collection("payment_methods")

//         // ============ USERS API ============
//         app.get('/api/users', async (req, res) => {
//             try {
//                 const cursor = usersCollection.find();
//                 const result = await cursor.toArray();
//                 res.send(result);
//             } catch (error) {
//                 console.error('Error fetching users:', error);
//                 res.status(500).json({ error: 'Failed to fetch users' });
//             }
//         })

//         // ============ JOBS API ============
//         app.get('/api/jobs', async (req, res) => {
//             try {
//                 const query = {}
//                 if (req.query.companyId) {
//                     query.companyId = req.query.companyId
//                 }
//                 if (req.query.status) {
//                     query.status = req.query.status
//                 }
//                 if (req.query.location) {
//                     query.location = { $regex: req.query.location, $options: 'i' }
//                 }
//                 if (req.query.type) {
//                     query.type = req.query.type
//                 }

//                 const cursor = jobCollection.find(query);
//                 const result = await cursor.toArray();
//                 console.log(`📊 Found ${result.length} jobs`);
//                 res.send(result);
//             } catch (error) {
//                 console.error('Error fetching jobs:', error);
//                 res.status(500).json({ error: 'Failed to fetch jobs' });
//             }
//         })

//         app.get('/api/jobs/:id', async (req, res) => {
//             try {
//                 const id = req.params.id;
//                 const query = { _id: new ObjectId(id) }
//                 const result = await jobCollection.findOne(query);
//                 if (!result) {
//                     return res.status(404).json({ error: 'Job not found' });
//                 }
//                 res.send(result);
//             } catch (error) {
//                 console.error('Error fetching job:', error);
//                 res.status(500).json({ error: 'Failed to fetch job' });
//             }
//         })

//         app.post('/api/jobs', async (req, res) => {
//             try {
//                 const job = req.body;
//                 const newJob = {
//                     ...job,
//                     createdAt: new Date(),
//                     updatedAt: new Date()
//                 }
//                 console.log("Received job:", newJob);
//                 const result = await jobCollection.insertOne(newJob);
//                 res.send({
//                     success: true,
//                     message: 'Job created successfully',
//                     jobId: result.insertedId
//                 });
//             } catch (error) {
//                 console.error('Error creating job:', error);
//                 res.status(500).json({ error: 'Failed to create job' });
//             }
//         })

//         app.put('/api/jobs/:id', async (req, res) => {
//             try {
//                 const id = req.params.id;
//                 const updates = req.body;
//                 const result = await jobCollection.updateOne(
//                     { _id: new ObjectId(id) },
//                     { $set: { ...updates, updatedAt: new Date() } }
//                 );
//                 if (result.matchedCount === 0) {
//                     return res.status(404).json({ error: 'Job not found' });
//                 }
//                 res.send({
//                     success: true,
//                     message: 'Job updated successfully'
//                 });
//             } catch (error) {
//                 console.error('Error updating job:', error);
//                 res.status(500).json({ error: 'Failed to update job' });
//             }
//         })

//         app.delete('/api/jobs/:id', async (req, res) => {
//             try {
//                 const id = req.params.id;
//                 const result = await jobCollection.deleteOne({ _id: new ObjectId(id) });
//                 if (result.deletedCount === 0) {
//                     return res.status(404).json({ error: 'Job not found' });
//                 }
//                 res.send({
//                     success: true,
//                     message: 'Job deleted successfully'
//                 });
//             } catch (error) {
//                 console.error('Error deleting job:', error);
//                 res.status(500).json({ error: 'Failed to delete job' });
//             }
//         })

//         // ============ JOB APPLICATIONS API ============
//         app.get('/api/applications', async (req, res) => {
//             try {
//                 const query = {}
//                 if (req.query.applicantId) {
//                     query.applicantId = req.query.applicantId;
//                 }
//                 if (req.query.jobId) {
//                     query.jobId = req.query.jobId;
//                 }
//                 const cursor = jobApplicationCollection.find(query);
//                 const result = await cursor.toArray()
//                 res.send(result)
//             } catch (error) {
//                 console.error('Error fetching applications:', error);
//                 res.status(500).json({ error: 'Failed to fetch applications' });
//             }
//         })

//         app.post('/api/applications', async (req, res) => {
//             try {
//                 const application = req.body
//                 const newApplication = {
//                     ...application,
//                     createdAt: new Date(),
//                     status: 'pending'
//                 }
//                 const result = await jobApplicationCollection.insertOne(newApplication);
//                 res.send({
//                     success: true,
//                     message: 'Application submitted successfully',
//                     applicationId: result.insertedId
//                 });
//             } catch (error) {
//                 console.error('Error creating application:', error);
//                 res.status(500).json({ error: 'Failed to submit application' });
//             }
//         })

//         // ============ COMPANIES API ============
//         app.get('/api/companies', async (req, res) => {
//             try {
//                 const cursor = companyCollection.find();
//                 const result = await cursor.toArray();
//                 console.log(`📊 Found ${result.length} companies`);
//                 res.send(result)
//             } catch (error) {
//                 console.error('Error fetching companies:', error);
//                 res.status(500).json({ error: 'Failed to fetch companies' });
//             }
//         })

//         app.get('/api/companies/:id', async (req, res) => {
//             try {
//                 const id = req.params.id;
//                 console.log(`🔍 Fetching company with ID: ${id}`);
                
//                 if (!ObjectId.isValid(id)) {
//                     console.log(`❌ Invalid ObjectId: ${id}`);
//                     return res.status(400).json({ error: 'Invalid company ID format' });
//                 }
                
//                 const query = { _id: new ObjectId(id) };
//                 const result = await companyCollection.findOne(query);
                
//                 if (!result) {
//                     console.log(`❌ Company not found with ID: ${id}`);
//                     return res.status(404).json({ error: 'Company not found' });
//                 }
                
//                 console.log(`✅ Found company: ${result.name}`);
//                 res.send(result);
//             } catch (error) {
//                 console.error('Error fetching company:', error);
//                 res.status(500).json({ error: 'Failed to fetch company' });
//             }
//         });

//         app.get('/api/my/companies', async (req, res) => {
//             try {
//                 const query = {}
//                 if (req.query.recruiterId) {
//                     query.recruiterId = req.query.recruiterId;
//                 }
//                 const result = await companyCollection.findOne(query);
//                 res.send(result || {});
//             } catch (error) {
//                 console.error('Error fetching company:', error);
//                 res.status(500).json({ error: 'Failed to fetch company' });
//             }
//         })

//         app.post('/api/companies', async (req, res) => {
//             try {
//                 const company = req.body;
//                 const newCompany = {
//                     ...company,
//                     createdAt: new Date(),
//                     status: 'pending'
//                 }
//                 const result = await companyCollection.insertOne(newCompany);
//                 res.send({
//                     success: true,
//                     message: 'Company created successfully',
//                     companyId: result.insertedId
//                 });
//             } catch (error) {
//                 console.error('Error creating company:', error);
//                 res.status(500).json({ error: 'Failed to create company' });
//             }
//         })

//         app.put('/api/companies/:id', async (req, res) => {
//             try {
//                 const id = req.params.id;
//                 const updates = req.body;
                
//                 if (!ObjectId.isValid(id)) {
//                     return res.status(400).json({ error: 'Invalid company ID format' });
//                 }
                
//                 const result = await companyCollection.updateOne(
//                     { _id: new ObjectId(id) },
//                     { $set: { ...updates, updatedAt: new Date() } }
//                 );
                
//                 if (result.matchedCount === 0) {
//                     return res.status(404).json({ error: 'Company not found' });
//                 }
                
//                 res.send({
//                     success: true,
//                     message: 'Company updated successfully'
//                 });
//             } catch (error) {
//                 console.error('Error updating company:', error);
//                 res.status(500).json({ error: 'Failed to update company' });
//             }
//         })

//         // ============ PLANS API ============
//         app.get('/api/plans', async (req, res) => {
//             try {
//                 const query = {}
//                 if (req.query.plan_id) {
//                     query.id = req.query.plan_id;
//                 }
//                 if (!req.query.plan_id) {
//                     const cursor = planCollection.find();
//                     const result = await cursor.toArray();
//                     return res.send(result);
//                 }
//                 const result = await planCollection.findOne(query);
//                 res.send(result);
//             } catch (error) {
//                 console.error('Error fetching plans:', error);
//                 res.status(500).json({ error: 'Failed to fetch plans' });
//             }
//         })

//         // ============ SUBSCRIPTION API ============
//         app.post('/api/subscriptions', async (req, res) => {
//             try {
//                 const data = req.body;
//                 const subsInfo = {
//                     ...data,
//                     status: 'active',
//                     createdAt: new Date()
//                 }

//                 const existingSub = await subscriptionCollection.findOne({ email: data.email });
//                 let result;

//                 if (existingSub) {
//                     result = await subscriptionCollection.updateOne(
//                         { email: data.email },
//                         { $set: subsInfo }
//                     );
//                 } else {
//                     result = await subscriptionCollection.insertOne(subsInfo);
//                 }

//                 await usersCollection.updateOne(
//                     { email: data.email },
//                     { $set: { plan: data.planId } }
//                 );

//                 const plan = await planCollection.findOne({ id: data.planId });
//                 await billingHistoryCollection.insertOne({
//                     email: data.email,
//                     plan: plan?.name || data.planId,
//                     amount: parseFloat(plan?.price) || 0,
//                     transactionId: `SUB-${Date.now()}`,
//                     status: 'paid',
//                     date: new Date(),
//                     description: `Subscribed to ${plan?.name || data.planId} plan`
//                 });

//                 res.send({
//                     success: true,
//                     subscription: result,
//                     message: 'Subscription created successfully'
//                 });
//             } catch (error) {
//                 console.error('Subscription creation error:', error);
//                 res.status(500).json({ error: 'Failed to create subscription' });
//             }
//         })

//         // ============ BILLING ROUTES ============
//         app.get('/api/billing/subscription', async (req, res) => {
//             try {
//                 const { email } = req.query;
//                 if (!email) {
//                     return res.status(400).json({ error: 'Email is required' });
//                 }

//                 const subscription = await subscriptionCollection.findOne({ email: email });

//                 if (!subscription) {
//                     const freePlan = await planCollection.findOne({ id: 'seeker_free' });
//                     return res.json({
//                         planId: 'seeker_free',
//                         planName: freePlan?.name || 'Free',
//                         planTier: freePlan?.tier || 'free',
//                         description: freePlan?.description || 'Basic plan with essential features',
//                         features: freePlan?.features || [],
//                         status: 'inactive',
//                         amount: 0,
//                         userPlan: 'free'
//                     });
//                 }

//                 let planDetails = null;
//                 if (subscription && subscription.planId) {
//                     planDetails = await planCollection.findOne({ id: subscription.planId });
//                 }

//                 const user = await usersCollection.findOne({ email: email });

//                 const response = {
//                     ...subscription,
//                     planName: planDetails?.name || 'Free',
//                     planTier: planDetails?.tier || 'free',
//                     description: planDetails?.description || 'Basic plan with essential features',
//                     features: planDetails?.features || [],
//                     status: subscription?.status || 'inactive',
//                     userPlan: user?.plan || 'free',
//                     amount: planDetails?.price || 0
//                 };

//                 res.json(response);
//             } catch (error) {
//                 console.error('Error fetching subscription:', error);
//                 res.status(500).json({ error: 'Failed to fetch subscription' });
//             }
//         });

//         app.get('/api/billing/history', async (req, res) => {
//             try {
//                 const { email } = req.query;
//                 if (!email) {
//                     return res.status(400).json({ error: 'Email is required' });
//                 }

//                 let history = await billingHistoryCollection
//                     .find({ email: email })
//                     .sort({ date: -1 })
//                     .limit(50)
//                     .toArray();

//                 if (!history || history.length === 0) {
//                     return res.json([]);
//                 }

//                 const formattedHistory = history.map((item) => ({
//                     id: item._id?.toString(),
//                     date: item.date || new Date(),
//                     plan: item.plan || 'Unknown',
//                     amount: item.amount || 0,
//                     transactionId: item.transactionId || `TX-${Date.now()}`,
//                     status: item.status || 'paid',
//                     invoiceUrl: item.invoiceUrl || null,
//                     description: item.description || ''
//                 }));

//                 res.json(formattedHistory);
//             } catch (error) {
//                 console.error('Error fetching billing history:', error);
//                 res.status(500).json({ error: 'Failed to fetch billing history' });
//             }
//         });

//         app.get('/api/billing/payment-methods', async (req, res) => {
//             try {
//                 const { email } = req.query;
//                 if (!email) {
//                     return res.status(400).json({ error: 'Email is required' });
//                 }

//                 const paymentMethods = await paymentMethodsCollection
//                     .find({ email: email })
//                     .toArray();

//                 if (!paymentMethods || paymentMethods.length === 0) {
//                     const subscription = await subscriptionCollection.findOne({ email: email });
//                     if (subscription) {
//                         return res.json([{
//                             id: 'default-1',
//                             email: email,
//                             brand: 'VISA',
//                             last4: '4242',
//                             expiryMonth: '12',
//                             expiryYear: '25',
//                             isDefault: true,
//                             cardholder: 'ALEXANDER SEEKER'
//                         }]);
//                     }
//                 }

//                 res.json(paymentMethods);
//             } catch (error) {
//                 console.error('Error fetching payment methods:', error);
//                 res.status(500).json({ error: 'Failed to fetch payment methods' });
//             }
//         });

//         app.post('/api/billing/upgrade', async (req, res) => {
//             try {
//                 const { email, planId } = req.body;

//                 if (!email || !planId) {
//                     return res.status(400).json({ error: 'Email and planId are required' });
//                 }

//                 const user = await usersCollection.findOne({ email: email });
//                 if (!user) {
//                     return res.status(404).json({ error: 'User not found' });
//                 }

//                 const plan = await planCollection.findOne({ id: planId });
//                 if (!plan) {
//                     return res.status(404).json({ error: 'Plan not found' });
//                 }

//                 const subscriptionData = {
//                     email: email,
//                     planId: planId,
//                     status: 'active',
//                     amount: parseFloat(plan.price) || 0,
//                     updatedAt: new Date()
//                 };

//                 const existingSub = await subscriptionCollection.findOne({ email: email });
//                 let result;

//                 if (existingSub) {
//                     result = await subscriptionCollection.updateOne(
//                         { email: email },
//                         { $set: subscriptionData }
//                     );
//                 } else {
//                     subscriptionData.createdAt = new Date();
//                     result = await subscriptionCollection.insertOne(subscriptionData);
//                 }

//                 await usersCollection.updateOne(
//                     { email: email },
//                     { $set: { plan: planId } }
//                 );

//                 await billingHistoryCollection.insertOne({
//                     email: email,
//                     plan: plan.name || planId,
//                     amount: parseFloat(plan.price) || 0,
//                     transactionId: `UPG-${Date.now()}`,
//                     status: 'paid',
//                     date: new Date(),
//                     description: `Upgraded to ${plan.name} plan`
//                 });

//                 res.json({
//                     success: true,
//                     message: 'Subscription upgraded successfully',
//                     subscription: subscriptionData
//                 });
//             } catch (error) {
//                 console.error('Upgrade error:', error);
//                 res.status(500).json({ error: 'Failed to upgrade subscription' });
//             }
//         });

//         app.post('/api/billing/cancel', async (req, res) => {
//             try {
//                 const { email } = req.body;

//                 if (!email) {
//                     return res.status(400).json({
//                         success: false,
//                         error: 'Email is required'
//                     });
//                 }

//                 const currentSub = await subscriptionCollection.findOne({ email: email });

//                 if (!currentSub) {
//                     return res.status(404).json({
//                         success: false,
//                         error: 'No active subscription found'
//                     });
//                 }

//                 await subscriptionCollection.updateOne(
//                     { email: email },
//                     {
//                         $set: {
//                             status: 'cancelled',
//                             planId: 'seeker_free',
//                             amount: 0,
//                             cancelAtPeriodEnd: true,
//                             updatedAt: new Date()
//                         }
//                     }
//                 );

//                 await usersCollection.updateOne(
//                     { email: email },
//                     { $set: { plan: 'free' } }
//                 );

//                 await billingHistoryCollection.insertOne({
//                     email: email,
//                     plan: currentSub.planId || 'Unknown',
//                     amount: 0,
//                     transactionId: `CAN-${Date.now()}`,
//                     status: 'cancelled',
//                     date: new Date(),
//                     description: `Subscription cancelled (was ${currentSub.planId})`
//                 });

//                 const updatedSub = await subscriptionCollection.findOne({ email: email });

//                 return res.status(200).json({
//                     success: true,
//                     message: 'Subscription cancelled successfully',
//                     subscription: updatedSub,
//                     userPlan: 'free'
//                 });

//             } catch (error) {
//                 console.error('Cancel error:', error);
//                 return res.status(500).json({
//                     success: false,
//                     error: error.message || 'Failed to cancel subscription'
//                 });
//             }
//         });

//         // ============ TEST ENDPOINT ============
//         app.get('/api/test', (req, res) => {
//             res.json({
//                 success: true,
//                 message: 'Server is running!',
//                 timestamp: new Date().toISOString(),
//                 endpoints: {
//                     jobs: '/api/jobs',
//                     companies: '/api/companies',
//                     companyById: '/api/companies/:id',
//                     plans: '/api/plans',
//                     subscription: '/api/billing/subscription',
//                     billing: '/api/billing/history'
//                 }
//             });
//         });

//         await client.db("admin").command({ ping: 1 });
//         console.log("✅ Pinged your deployment. You successfully connected to MongoDB!");

//         // ✅ Only ONE app.listen() here - inside the run() function
//         app.listen(port, () => {
//             console.log(`🚀 Server running on port ${port}`)
//         })

//     } catch (error) {
//         console.error("❌ Error connecting to MongoDB:", error);
//     }
// }

// run().catch(console.dir);

// // ❌ REMOVED: Duplicate app.listen() at the bottom
// // app.listen(port, () => {
// //     console.log(`🚀 Server running on port ${port}`)
// // })