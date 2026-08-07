// backend/test-exports.js
const { getCollections } = require('./src/lib/dbUtils');

console.log('Testing dbUtils exports...');

try {
    const collections = getCollections();
    console.log('✅ getCollections works!');
    console.log('Collections:', Object.keys(collections));
} catch (error) {
    console.error('❌ Error:', error.message);
}