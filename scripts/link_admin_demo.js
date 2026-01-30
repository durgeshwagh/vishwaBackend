const mongoose = require('mongoose');
const User = require('../src/models/User');
const Member = require('../src/models/Member');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/community_app_db')
    .then(async () => {
        console.log('Connected to MongoDB');

        const member = await Member.findOne();
        if (!member) {
            console.log('No members found to link.');
            process.exit(1);
        }

        const user = await User.findOne({ username: 'admin' });
        if (!user) {
            console.log('Admin user not found.');
            process.exit(1);
        }

        // Check if memberId is already stored as ObjectId or String in Schema
        // Based on other files, it seems to be ObjectId usually but let's just assign.
        user.memberId = member._id;
        await user.save();
        console.log(`Admin linked to Member: ${member.firstName} ${member.lastName} (${member._id})`);

        mongoose.disconnect();
    })
    .catch(err => {
        console.error(err);
        mongoose.disconnect();
        process.exit(1);
    });
