const mongoose = require('mongoose');
const User = require('./src/models/User');
const Member = require('./src/models/Member');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

const linkAdmin = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const adminUser = await User.findOne({ username: 'admin' });
        if (!adminUser) {
            console.log('Admin user not found!');
            return;
        }

        console.log('Admin User found:', adminUser.username, adminUser.email);

        let member = await Member.findOne({ email: adminUser.email });
        
        if (!member) {
            console.log('No matching member found for email:', adminUser.email);
            console.log('Creating a profile for Admin...');
            
            member = new Member({
                memberId: 'ADMIN001',
                personal_info: {
                    names: {
                        first_name: 'System',
                        last_name: 'Admin'
                    },
                    dob: new Date('1990-01-01'),
                    gender: 'Male',
                    life_status: 'Alive',
                    biodata: {
                        contact: {
                            email: adminUser.email,
                            mobile: adminUser.mobile || '9999999999'
                        }
                    }
                },
                // Backward compatibility fields
                firstName: 'System',
                lastName: 'Admin',
                email: adminUser.email,
                phone: adminUser.mobile || '9999999999',
                gender: 'Male',
                dob: new Date('1990-01-01'),
                maritalStatus: 'Single',
                
                geography: {
                    state: 'Maharashtra',
                    district: 'Pune',
                    taluka: 'Pune City',
                    village: 'Pune',
                    pincode: 411001
                },
                // Flat fields for compatibility
                state: 'Maharashtra',
                district: 'Pune',
                city: 'Pune',
                village: 'Pune',
                address: 'Community Office',
                
                isPrimary: true,
                familyId: 'Unassigned',
                fullName: 'System Admin'
            });
            await member.save();
            console.log('Created new Member profile for Admin:', member._id);
        } else {
            console.log('Found existing member:', member.firstName, member.lastName);
        }

        // Link them if not linked or mismatch
        if (!adminUser.memberId || adminUser.memberId.toString() !== member._id.toString()) {
            adminUser.memberId = member._id;
            await adminUser.save();
            console.log('Linked Admin User to Member Profile successfully.');
        } else {
            console.log('Admin User is already validly linked.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
};

linkAdmin();
