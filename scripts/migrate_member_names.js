const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const EXTERNAL_API = 'https://india-location-hub.in/api';

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/community_vishwkarma';

const MemberSchema = new mongoose.Schema({
    firstName: String,
    middleName: String,
    lastName: String,
    state: String,
    district: String,
    city: String, // taluka
    village: String,
    fullName: String,
    stateName: String,
    districtName: String,
    talukaName: String,
    villageName: String
}, { strict: false });

const Member = mongoose.model('Member', MemberSchema);

async function migrate() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const members = await Member.find({});
        console.log(`Found ${members.length} members to process`);

        const statesCache = new Map();
        const districtsCache = new Map();
        const talukasCache = new Map();
        const villagesCache = new Map();

        // 1. Fetch States
        console.log('Fetching states...');
        const statesResp = await axios.get(`${EXTERNAL_API}/states`);
        const stateNameToCode = new Map();
        if (statesResp.data && statesResp.data.success) {
            statesResp.data.states.forEach(s => {
                statesCache.set(String(s.code), s.name);
                statesCache.set(String(s.id), s.name);
                stateNameToCode.set(s.name.toUpperCase(), String(s.code));
            });
        }

        let updatedCount = 0;

        for (const member of members) {
            const updates = {};
            
            // Calculate fullName
            const f = member.firstName || '';
            const m = member.middleName || '';
            const l = member.lastName || '';
            const fullName = `${f} ${m} ${l}`.replace(/\s+/g, ' ').trim();
            if (fullName && member.fullName !== fullName) {
                updates.fullName = fullName;
            }

            // Normalize state/district/city if they are names
            let stateCode = member.state;
            if (stateCode && isNaN(parseInt(stateCode))) {
                stateCode = stateNameToCode.get(stateCode.toUpperCase());
            }

            // Resolve State
            if (member.state && !member.stateName) {
                const sName = statesCache.get(String(member.state)) || (isNaN(parseInt(member.state)) ? member.state : null);
                if (sName) updates.stateName = sName;
            }

            // Resolve District
            if (stateCode && member.district && !member.districtName) {
                const dCacheKey = `${stateCode}`;
                if (!districtsCache.has(dCacheKey)) {
                    console.log(`Fetching districts for state ${stateCode}...`);
                    const dResp = await axios.get(`${EXTERNAL_API}/districts`, { params: { state_code: stateCode } });
                    
                    let districts = [];
                    if (dResp.data && dResp.data.success) {
                        districts = dResp.data.districts;
                    } else {
                        const dResp2 = await axios.get(`${EXTERNAL_API}/districts`, { params: { state_id: stateCode } });
                        if (dResp2.data && dResp2.data.success) districts = dResp2.data.districts;
                    }

                    const dMap = new Map();
                    const dNameToCode = new Map();
                    districts.forEach(d => {
                        dMap.set(String(d.code), d.name);
                        dMap.set(String(d.id), d.name);
                        dNameToCode.set(d.name.toUpperCase(), String(d.code));
                    });
                    districtsCache.set(dCacheKey, { codes: dMap, names: dNameToCode });
                }
                
                const dCache = districtsCache.get(dCacheKey);
                const dName = dCache.codes.get(String(member.district)) || (isNaN(parseInt(member.district)) ? member.district : null);
                if (dName) updates.districtName = dName;
            }

            // Resolve Taluka
            let districtCode = member.district;
            if (districtCode && isNaN(parseInt(districtCode)) && stateCode) {
                 districtCode = districtsCache.get(stateCode)?.names.get(districtCode.toUpperCase());
            }

            if (districtCode && member.city && !member.talukaName) {
                const tCacheKey = `${districtCode}`;
                if (!talukasCache.has(tCacheKey)) {
                    console.log(`Fetching talukas for district ${districtCode}...`);
                    const tResp = await axios.get(`${EXTERNAL_API}/talukas`, { params: { district_code: districtCode } });
                    
                    let talukas = [];
                    if (tResp.data && tResp.data.success) {
                        talukas = tResp.data.talukas;
                    } else {
                        const tResp2 = await axios.get(`${EXTERNAL_API}/talukas`, { params: { district_id: districtCode } });
                        if (tResp2.data && tResp2.data.success) talukas = tResp2.data.talukas;
                    }

                    const tMap = new Map();
                    talukas.forEach(t => {
                        tMap.set(String(t.code), t.name);
                        tMap.set(String(t.id), t.name);
                    });
                    talukasCache.set(tCacheKey, tMap);
                }
                const tName = talukasCache.get(tCacheKey)?.get(String(member.city)) || (isNaN(parseInt(member.city)) ? member.city : null);
                if (tName) updates.talukaName = tName;
            }

            // Village
            if (member.city && member.village && !member.villageName) {
                 const vName = isNaN(parseInt(member.village)) ? member.village : null;
                 if (vName) updates.villageName = vName;
            }

            if (Object.keys(updates).length > 0) {
                console.log(`Updating member ${member.firstName} ${member.lastName}:`, JSON.stringify(updates));
                await Member.updateOne({ _id: member._id }, { $set: updates });
                updatedCount++;
            }
        }

        console.log(`Migration completed. Updated ${updatedCount} members.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
