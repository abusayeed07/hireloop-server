// // backend/src/controllers/paymentController.js
// const { ObjectId } = require('mongodb');
// const { getCollections } = require('../lib/dbUtils');

// exports.getPaymentMethods = async (req, res) => {
//     try {
//         const { paymentMethodsCollection } = getCollections();
//         const email = req.user?.email || req.query?.email;
        
//         if (!email) {
//             return res.status(400).json({ error: 'Email is required' });
//         }

//         const paymentMethods = await paymentMethodsCollection
//             .find({ email: email })
//             .sort({ createdAt: -1 })
//             .toArray();

//         // If no payment methods found, return empty array
//         res.json(paymentMethods || []);
//     } catch (error) {
//         console.error('❌ Error fetching payment methods:', error);
//         res.status(500).json({ error: 'Failed to fetch payment methods' });
//     }
// };

// exports.addPaymentMethod = async (req, res) => {
//     try {
//         const { paymentMethodsCollection } = getCollections();
//         const email = req.user?.email;
//         const paymentData = req.body;
        
//         if (!email) {
//             return res.status(400).json({ error: 'Email is required' });
//         }

//         // Validate required fields
//         const requiredFields = ['cardNumber', 'expiryMonth', 'expiryYear', 'cardholderName'];
//         for (const field of requiredFields) {
//             if (!paymentData[field]) {
//                 return res.status(400).json({ 
//                     success: false, 
//                     error: `${field} is required` 
//                 });
//             }
//         }

//         // Mask card number (only store last 4 digits)
//         const last4 = paymentData.cardNumber.slice(-4);
        
//         // Determine card brand from first digit
//         const firstDigit = paymentData.cardNumber.charAt(0);
//         let brand = 'Unknown';
//         if (firstDigit === '4') brand = 'VISA';
//         else if (firstDigit === '5') brand = 'MasterCard';
//         else if (firstDigit === '3') brand = 'American Express';
//         else if (firstDigit === '6') brand = 'Discover';

//         const newPaymentMethod = {
//             email: email,
//             brand: paymentData.brand || brand,
//             last4: last4,
//             expiryMonth: paymentData.expiryMonth,
//             expiryYear: paymentData.expiryYear,
//             cardholderName: paymentData.cardholderName,
//             isDefault: paymentData.isDefault || false,
//             createdAt: new Date(),
//             updatedAt: new Date()
//         };

//         // If this is set as default, remove default from other cards
//         if (newPaymentMethod.isDefault) {
//             await paymentMethodsCollection.updateMany(
//                 { email: email },
//                 { $set: { isDefault: false } }
//             );
//         }

//         const result = await paymentMethodsCollection.insertOne(newPaymentMethod);
        
//         res.status(201).json({
//             success: true,
//             message: 'Payment method added successfully',
//             paymentMethodId: result.insertedId,
//             paymentMethod: {
//                 ...newPaymentMethod,
//                 _id: result.insertedId
//             }
//         });
//     } catch (error) {
//         console.error('❌ Error adding payment method:', error);
//         res.status(500).json({ 
//             success: false, 
//             error: error.message || 'Failed to add payment method' 
//         });
//     }
// };

// exports.deletePaymentMethod = async (req, res) => {
//     try {
//         const { paymentMethodsCollection } = getCollections();
//         const email = req.user?.email;
//         const { paymentMethodId } = req.params;
        
//         if (!email) {
//             return res.status(400).json({ error: 'Email is required' });
//         }

//         if (!ObjectId.isValid(paymentMethodId)) {
//             return res.status(400).json({ error: 'Invalid payment method ID' });
//         }

//         const result = await paymentMethodsCollection.deleteOne({
//             _id: new ObjectId(paymentMethodId),
//             email: email
//         });

//         if (result.deletedCount === 0) {
//             return res.status(404).json({ 
//                 success: false, 
//                 error: 'Payment method not found' 
//             });
//         }

//         res.json({
//             success: true,
//             message: 'Payment method deleted successfully'
//         });
//     } catch (error) {
//         console.error('❌ Error deleting payment method:', error);
//         res.status(500).json({ 
//             success: false, 
//             error: error.message || 'Failed to delete payment method' 
//         });
//     }
// };

// exports.setDefaultPaymentMethod = async (req, res) => {
//     try {
//         const { paymentMethodsCollection } = getCollections();
//         const email = req.user?.email;
//         const { paymentMethodId } = req.params;
        
//         if (!email) {
//             return res.status(400).json({ error: 'Email is required' });
//         }

//         if (!ObjectId.isValid(paymentMethodId)) {
//             return res.status(400).json({ error: 'Invalid payment method ID' });
//         }

//         // Remove default from all cards
//         await paymentMethodsCollection.updateMany(
//             { email: email },
//             { $set: { isDefault: false } }
//         );

//         // Set this card as default
//         const result = await paymentMethodsCollection.updateOne(
//             { 
//                 _id: new ObjectId(paymentMethodId),
//                 email: email 
//             },
//             { $set: { isDefault: true, updatedAt: new Date() } }
//         );

//         if (result.matchedCount === 0) {
//             return res.status(404).json({ 
//                 success: false, 
//                 error: 'Payment method not found' 
//             });
//         }

//         res.json({
//             success: true,
//             message: 'Default payment method updated successfully'
//         });
//     } catch (error) {
//         console.error('❌ Error setting default payment method:', error);
//         res.status(500).json({ 
//             success: false, 
//             error: error.message || 'Failed to set default payment method' 
//         });
//     }
// };