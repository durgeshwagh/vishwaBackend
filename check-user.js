const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vishwkarma');
        console.log('Connected to MongoDB');

        const user = await User.findOne({ username: 'Nayneshrathod' });

        if (!user) {
            console.log('User not found!');
            return;
        }

        console.log('\n=== USER DATA ===');
        console.log('Username:', user.username);
        console.log('Name:', user.name || 'NOT SET');
        console.log('Email:', user.email);
        console.log('Mobile:', user.mobile);
        console.log('Role:', user.role);
        console.log('MemberId:', user.memberId || 'NOT SET');
        console.log('================\n');

        await mongoose.connection.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
};

checkUser();
