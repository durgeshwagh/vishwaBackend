const mongoose = require('mongoose');
const User = require('../src/models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function resetAdmin() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');
        
        const passwordRaw = 'Admin@123';
        const hashedPassword = await bcrypt.hash(passwordRaw, 10);
        
        let user = await User.findOne({ username: 'admin' });
        if (user) {
            console.log('User "admin" found. Resetting password...');
            user.password = hashedPassword;
            user.role = 'SuperAdmin';
            user.isVerified = true;
            // Force update permissions
            user.permissions = [
                'login.access', 'admin.access',
                'member.view', 'member.create', 'member.edit', 'member.delete',
                'funds.view', 'funds.create', 'funds.edit', 'funds.delete',
                'matrimony.view', 'matrimony.create',
                'committee.view', 'committee.create',
                'notices.view', 'notices.create',
                'events.view', 'events.create',
                'primary.view'
            ];
            await user.save();
            console.log('SUCCESS: Password reset to: Admin@123');
        } else {
            console.log('User "admin" not found. Creating...');
            user = new User({
                username: 'admin',
                password: hashedPassword,
                email: 'admin@community.com',
                role: 'SuperAdmin',
                isVerified: true,
                name: 'Super Admin',
                permissions: [
                    'login.access', 'admin.access',
                    'member.view', 'member.create', 'member.edit', 'member.delete',
                    'funds.view', 'funds.create', 'funds.edit', 'funds.delete',
                    'matrimony.view', 'matrimony.create',
                    'committee.view', 'committee.create',
                    'notices.view', 'notices.create',
                    'events.view', 'events.create',
                    'primary.view'
                ]
            });
            await user.save();
            console.log('SUCCESS: User created with password: Admin@123');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

resetAdmin();
