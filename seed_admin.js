
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
require('dotenv').config();

const MONGO_URI = 'mongodb://localhost:27017/community_app_db';

const seedAdmin = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const username = 'admin';
        const passwordRaw = 'admin123';
        const hashedPassword = await bcrypt.hash(passwordRaw, 10);

        // Check if exists
        const exists = await User.findOne({ username });
        if (exists) {
            console.log('Admin user already exists. Updating password and permissions...');
            exists.password = hashedPassword;
            exists.role = 'SuperAdmin';
            exists.isVerified = true;
            exists.permissions = ['create', 'read', 'update', 'delete', 'verify_users'];
            await exists.save();
            console.log('Admin user updated.');
        } else {
            console.log('Creating new Admin user...');
            const newAdmin = new User({
                username,
                password: hashedPassword,
                role: 'SuperAdmin',
                isVerified: true,
                email: 'admin@example.com',
                name: 'System Admin',
                permissions: ['create', 'read', 'update', 'delete', 'verify_users']
            });
            await newAdmin.save();
            console.log('Admin user created.');
        }

    } catch (e) {
        console.error('Error seeding admin:', e);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
};

seedAdmin();
