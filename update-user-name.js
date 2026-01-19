const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

// UPDATE THIS WITH THE ACTUAL NAME
const USERNAME = 'Nayneshrathod';
const NEW_NAME = 'Naynesh Rathod'; // 👈 Change this to actual name

const updateUserName = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vishwkarma');
        console.log('Connected to MongoDB\n');

        const user = await User.findOne({ username: USERNAME });

        if (!user) {
            console.log('❌ User not found!');
            return;
        }

        console.log('Before Update:');
        console.log('  Username:', user.username);
        console.log('  Name:', user.name || 'NOT SET');

        // Update the name
        user.name = NEW_NAME;
        await user.save();

        console.log('\n✅ Name Updated Successfully!');
        console.log('After Update:');
        console.log('  Username:', user.username);
        console.log('  Name:', user.name);
        console.log('\n📌 Please restart the backend server and login again to see the change.\n');

        await mongoose.connection.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
};

updateUserName();
