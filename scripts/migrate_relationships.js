const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Member = require('../src/models/Member');
const Marriage = require('../src/models/Marriage');

// Load env from root
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/community_app_db';

async function migrate() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        console.log('Starting Marriage Migration...');
        const membersWithSpouse = await Member.find({ 
            spouseId: { $ne: null }
        });

        let count = 0;
        let skipped = 0;

        for (const m of membersWithSpouse) {
            if (!m.spouseId || m.spouseId.toString() === m._id.toString()) continue;

            const existingMarriage = await Marriage.findOne({
                $or: [
                    { husbandId: m._id, wifeId: m.spouseId },
                    { husbandId: m.spouseId, wifeId: m._id }
                ]
            });

            if (!existingMarriage) {
                const isMale = m.gender === 'Male';
                
                await Marriage.create({
                    husbandId: isMale ? m._id : m.spouseId,
                    wifeId: isMale ? m.spouseId : m._id,
                    status: 'Active'
                });
                count++;
            } else {
                skipped++;
            }
        }
        console.log(`Migration Complete. Created ${count} new marriage records. Skipped ${skipped} existing.`);
        
        process.exit(0);
    } catch (err) {
        console.error('Migration Error:', err);
        process.exit(1);
    }
}

migrate();
