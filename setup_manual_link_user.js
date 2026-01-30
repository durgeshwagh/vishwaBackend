const mongoose = require('mongoose');
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/community_app')
    .then(async () => {
        console.log('MongoDB Connected');

        // Create Test User with NO Member Linked
        const hashedPassword = await bcrypt.hash('test1234', 10);
        
        await User.deleteOne({ username: 'manual_link_test' });

        const testUser = new User({
            username: 'manual_link_test',
            password: hashedPassword,
            name: 'Manual Link Test',
            email: 'manual@test.com',
            mobile: '9999988888',
            role: 'Member',
            isVerified: true,
            permissions: ['login.access', 'member.view'],
            memberId: null // EXPLICITLY NULL
        });

        await testUser.save();
        console.log('Test User "manual_link_test" created (Unlinked).');

        mongoose.connection.close();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
