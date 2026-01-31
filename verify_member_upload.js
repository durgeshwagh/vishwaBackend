const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
    try {
        console.log('Logging in...');
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username: 'admin',
            password: 'Admin@123'
        });
        
        const token = loginRes.data.token;
        console.log('Login successful.');

        const uploadsDir = path.join(__dirname, 'uploads');
        const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
        
        if (files.length === 0) {
            console.error('No images found in uploads/ to test with.');
            return;
        }

        const testImagePath = path.join(uploadsDir, files[0]);

        // Test POST /api/members
        console.log('Testing POST /api/members (Add Member)...');
        const form = new FormData();
        form.append('firstName', 'Test');
        form.append('lastName', 'User');
        form.append('gender', 'Male');
        form.append('maritalStatus', 'Single');
        form.append('dob', '1990-01-01');
        form.append('photo', fs.createReadStream(testImagePath));

        try {
            const res = await axios.post('http://localhost:3000/api/members', form, {
                headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` }
            });
            console.log('POST /api/members SUCCESS!');
            console.log('Created Member ID:', res.data.memberId);
            console.log('Photo URL:', res.data.photoUrl);
        } catch (err) {
            console.error('POST /api/members ERROR:', err.response?.status, err.response?.data);
        }

    } catch (err) {
        console.error('SCRIPT ERROR:', err.message);
    }
}

run();
