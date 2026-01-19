const mongoose = require('mongoose');
const Member = require('./src/models/Member');
require('dotenv').config();

const checkMember = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vishwkarma');
        console.log('Connected to MongoDB');

        const email = 'nayneshrathod@gmail.com';
        const mobile = '8550949497';

        const member = await Member.findOne({
            $or: [
                { email: email },
                { phone: mobile }
            ]
        });

        if (!member) {
            console.log('\n❌ NO MEMBER FOUND with email:', email, 'or mobile:', mobile);
            console.log('User needs to link to a member record OR set name manually\n');
        } else {
            console.log('\n✅ MEMBER FOUND:');
            console.log('Member ID:', member.memberId);
            console.log('First Name:', member.firstName);
            console.log('Last Name:', member.lastName);
            console.log('Full Name:', `${member.firstName} ${member.lastName}`);
            console.log('Email:', member.email);
            console.log('Phone:', member.phone);
            console.log('================\n');
        }

        await mongoose.connection.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
};

checkMember();
