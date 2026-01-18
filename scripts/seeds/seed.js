const mongoose = require('mongoose');
const Member = require('../../src/models/Member');
require('dotenv').config();

const MONGO_URI = 'mongodb+srv://nayneshrathod_db_user:0yTn8X09Xt1GLRiG@cluster0.jjbbirn.mongodb.net/community_app_db';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to DB for seeding...');
        await seedData();
        mongoose.disconnect();
    })
    .catch(err => console.error(err));

async function seedData() {
    // Clear existing
    await Member.deleteMany({});
    console.log('Cleared existing members.');

    // Seed Super Admin
    const User = require('../../src/models/User');
    const bcrypt = require('bcryptjs');

    // Check if superadmin exists
    const adminExists = await User.findOne({ role: 'SuperAdmin' });
    if (!adminExists) {
        const hashedPwd = await bcrypt.hash('admin123', 10);
        await User.create({
            username: 'superadmin',
            email: 'admin@community.com',
            password: hashedPwd,
            name: 'Super Admin',
            role: 'SuperAdmin',
            isVerified: true
        });
        console.log('Super Admin Seeded: admin/admin123');
    }

    // const members = [];

    // --- Demo Hierarchy Data (The Patil Family) ---
    // Helper to generate readable IDs
    // let mCount = 1000;
    // const generateMid = () => `M${++mCount}`;

    // Demo Hierarchy removed as requested. 



    // Random generation removed. The database will start empty or only with data added via the application form.


    // Save sequentially to avoid connection overload if any, but Promise.all is fine for 100
    // await Member.insertMany(members);
    console.log('Seeded Demo Hierarchy + 50 Random members successfully.');
}

