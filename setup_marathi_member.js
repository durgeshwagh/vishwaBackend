const mongoose = require('mongoose');
const Member = require('./src/models/Member');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/community_app')
    .then(async () => {
        console.log('MongoDB Connected');

        // Create Test Member with Marathi Name
        const marathiMember = new Member({
            memberId: 'M_MARATHI_01',
            firstName: 'गणेश',
            lastName: 'पाटील',
            middleName: 'सुरेश',
            fullName: 'गणेश सुरेश पाटील',
            gender: 'Male',
            dob: new Date('1990-01-01'),
            maritalStatus: 'Single',
            personal_info: {
                names: {
                    first_name: 'गणेश',
                    last_name: 'पाटील',
                    middle_name: 'सुरेश'
                },
                dob: new Date('1990-01-01'),
                gender: 'Male'
            },
            isPrimary: false
        });

        await marathiMember.save();
        console.log('Test Member "गणेश पाटील" created.');

        mongoose.connection.close();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
