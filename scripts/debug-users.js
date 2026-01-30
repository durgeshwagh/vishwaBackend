const mongoose = require('mongoose');
const User = require('../src/models/User'); // Adjust path as needed
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/community_app_db';

async function listUsers() {
    try {
        console.log('Connecting to:', MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({}, 'username email role isVerified');
        console.log('--- Users in DB ---');
        console.table(users.map(u => ({ 
            id: u._id.toString(),
            username: u.username, 
            email: u.email, 
            role: u.role,
            isVerified: u.isVerified 
        })));
        console.log('-------------------');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
}

listUsers();
