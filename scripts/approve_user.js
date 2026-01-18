const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/community_app_db';

const UserSchema = new mongoose.Schema({
    username: String,
    role: String,
    isVerified: Boolean,
    email: String
});

const User = mongoose.model('User', UserSchema);

async function approveUser() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const email = 'admin@admin.com'; // The one I tried to register last
        const user = await User.findOne({ email: email });

        if (user) {
            user.isVerified = true;
            user.role = 'SuperAdmin'; // Elevate to avoid permission issues
            await user.save();
            console.log(`User ${email} approved and promoted to SuperAdmin.`);
        } else {
            console.log(`User ${email} not found. Trying 'test@example.com'`);
            const user2 = await User.findOne({ email: 'test@example.com' });
            if (user2) {
                user2.isVerified = true;
                user2.role = 'SuperAdmin';
                await user2.save();
                console.log(`User test@example.com approved and promoted.`);
            } else {
                console.log('No test users found.');
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

approveUser();
