const mongoose = require('mongoose');
const User = require('./src/models/User');
const Member = require('./src/models/Member');
require('dotenv').config();
require('dotenv').config();

// Since we can't easily hit the running server with supertest without exporting the app, 
// and `npm start` is running in background, we can use `axios` or similar to hit localhost:3000.
// OR we can just use a script to manipulate DB and print instructions.

// Better: A script that creates an UNLINKED user directly in DB.
// Then manual verification: user logs in as that user, creates a member.

const MONGO_URI = process.env.MONGO_URI;

const setupTestUser = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        const username = `testuser_${Date.now()}`;
        const password = 'password123'; // In real app this is hashed. 
        // Wait, if I insert directly, I need to hash it match login logic? 
        // Login uses bcrypt. 
        // Easier: Just create a user I can login with IF I know how.
        // OR: Just check existing users?
        
        // Let's create a User via the signup API? No, usually frontend/admin creates users.
        // I will use a known user or create one.
        
        console.log(`\n\n=== Manual Verification Instructions ===`);
        console.log(`1. Go to database and ensure you have a User with NO memberId.`);
        console.log(`2. OR run this script to create a dummy user 'autolink_test'`);
        
        // Let's create 'autolink_test'
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('test1234', 10);
        
        const user = new User({
            username: 'auto_create_admin',
            password: hashedPassword,
            email: 'admin_test@test.com',
            mobile: '1234567899',
            role: 'Admin', // Create an Admin to test the feature
            isVerified: true,
            permissions: [], // Admin has all permissions usually, or defaults
            memberId: null 
        });
        
        // Cleanup first
        await User.deleteOne({ username: 'auto_create_admin' });
        await Member.deleteOne({ email: 'admin_test@test.com' });
        
        await user.save();
        console.log(`Created Admin User: auto_create_admin / test1234`);
        console.log(`memberId is: ${user.memberId} (Expected: null or undefined)`);
        
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

setupTestUser();
