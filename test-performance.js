/**
 * Performance Test Script
 * Tests backend optimization with database queries and pagination
 */

const mongoose = require('mongoose');
const Member = require('./src/models/Member');
const User = require('./src/models/User');
const Fund = require('./src/models/Fund');
const Notice = require('./src/models/Notice');
require('dotenv').config();

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

async function runPerformanceTests() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vishwkarma');
        log(colors.green, '\n✅ Connected to MongoDB\n');

        // Test 1: User Name Display
        log(colors.blue, '🧪 Test 1: User Virtual displayName');
        const testUser = await User.findOne({ username: 'Nayneshrathod' });
        if (testUser) {
            console.log('  Username:', testUser.username);
            console.log('  Name:', testUser.name || 'NOT SET');
            console.log('  DisplayName (virtual):', testUser.displayName);
            log(colors.green, testUser.displayName ? '  ✅ PASS' : '  ❌ FAIL');
        } else {
            log(colors.yellow, '  ⚠️  User not found, skipping');
        }

        // Test 2: Member Count & Index Usage
        log(colors.blue, '\n🧪 Test 2: Member Query Performance');
        const memberCount = await Member.countDocuments();
        console.log(`  Total Members: ${memberCount}`);

        const start1 = Date.now();
        const members = await Member.find({ isPrimary: true })
            .select('firstName lastName email phone city')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        const time1 = Date.now() - start1;

        console.log(`  Primary Members Found: ${members.length}`);
        console.log(`  Query Time: ${time1}ms`);
        log(colors.green, time1 < 100 ? '  ✅ PASS (< 100ms)' : '  ⚠️  SLOW');

        // Test 3: Text Search Performance
        log(colors.blue, '\n🧪 Test 3: Member Text Search');
        const start2 = Date.now();
        const searchResults = await Member.find({
            $or: [
                { firstName: { $regex: 'a', $options: 'i' } },
                { lastName: { $regex: 'a', $options: 'i' } }
            ]
        })
            .select('firstName lastName')
            .limit(10)
            .lean();
        const time2 = Date.now() - start2;

        console.log(`  Search Results: ${searchResults.length}`);
        console.log(`  Query Time: ${time2}ms`);
        log(colors.green, time2 < 200 ? '  ✅ PASS (< 200ms)' : '  ⚠️  SLOW');

        // Test 4: Fund Queries
        log(colors.blue, '\n🧪 Test 4: Fund Model Performance');
        const fundCount = await Fund.countDocuments();
        console.log(`  Total Funds: ${fundCount}`);

        if (fundCount > 0) {
            const start3 = Date.now();
            const funds = await Fund.find()
                .sort({ date: -1 })
                .limit(20)
                .lean();
            const time3 = Date.now() - start3;

            console.log(`  Recent Funds Found: ${funds.length}`);
            console.log(`  Query Time: ${time3}ms`);
            log(colors.green, time3 < 100 ? '  ✅ PASS (< 100ms)' : '  ⚠️  SLOW');
        } else {
            log(colors.yellow, '  ⚠️  No funds in database, skipping');
        }

        // Test 5: Notice Queries
        log(colors.blue, '\n🧪 Test 5: Notice Model Performance');
        const noticeCount = await Notice.countDocuments();
        console.log(`  Total Notices: ${noticeCount}`);

        if (noticeCount > 0) {
            const start4 = Date.now();
            const notices = await Notice.find()
                .sort({ createdAt: -1 })
                .limit(20)
                .lean();
            const time4 = Date.now() - start4;

            console.log(`  Recent Notices Found: ${notices.length}`);
            console.log(`  Query Time: ${time4}ms`);
            log(colors.green, time4 < 100 ? '  ✅ PASS (< 100ms)' : '  ⚠️  SLOW');
        } else {
            log(colors.yellow, '  ⚠️  No notices in database, skipping');
        }

        // Test 6: Index Verification
        log(colors.blue, '\n🧪 Test 6: Index Verification');
        const userIndexes = await User.collection.getIndexes();
        const memberIndexes = await Member.collection.getIndexes();
        const fundIndexes = await Fund.collection.getIndexes();
        const noticeIndexes = await Notice.collection.getIndexes();

        console.log(`  User Indexes: ${Object.keys(userIndexes).length}`);
        console.log(`  Member Indexes: ${Object.keys(memberIndexes).length}`);
        console.log(`  Fund Indexes: ${Object.keys(fundIndexes).length}`);
        console.log(`  Notice Indexes: ${Object.keys(noticeIndexes).length}`);

        const hasRequiredIndexes =
            Object.keys(userIndexes).length >= 5 &&
            Object.keys(memberIndexes).length >= 8 &&
            Object.keys(fundIndexes).length >= 5 &&
            Object.keys(noticeIndexes).length >= 5;

        log(colors.green, hasRequiredIndexes ? '  ✅ PASS - All indexes created' : '  ⚠️  Some indexes missing');

        // Summary
        log(colors.green, '\n' + '='.repeat(50));
        log(colors.green, '✅ PERFORMANCE TESTS COMPLETED');
        log(colors.green, '='.repeat(50) + '\n');

        await mongoose.connection.close();
        process.exit(0);

    } catch (err) {
        log(colors.red, `\n❌ ERROR: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    }
}

runPerformanceTests();
