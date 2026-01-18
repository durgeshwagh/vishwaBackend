const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Family
 *   description: Family Management
 */
const Member = require('../models/Member');
const Marriage = require('../models/Marriage');
const User = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/family/my-family:
 *   get:
 *     summary: Get my family members
 *     tags: [Family]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Family details
 */
router.get('/my-family', verifyToken, async (req, res) => {
    try {
        const memberId = req.user.memberId;
        if (!memberId) return res.status(400).json({ message: 'User is not linked to a member profile' });

        // 1. Get Current Member Profile
        const currentMember = await Member.findOne({ memberId });
        if (!currentMember) return res.status(404).json({ message: 'Member profile not found' });

        // 2. Fetch Core Family (Birth Family - Same Family ID)
        let coreFamily = [];
        if (currentMember.familyId && currentMember.familyId !== 'Unassigned' && currentMember.familyId !== 'FNew') {
            coreFamily = await Member.find({ familyId: currentMember.familyId });
        } else {
            coreFamily = [currentMember];
        }

        const coreIds = coreFamily.map(m => m._id);

        // 3. Fetch Descendants/Relatives not in Core (e.g. Children of Married Daughters)
        const extendedRelatives = await Member.find({
            familyId: { $ne: currentMember.familyId },
            $or: [
                { fatherId: { $in: coreIds } },
                { motherId: { $in: coreIds } }
            ]
        });

        // 4. Fetch Marriages for ALL found members (Core + Extended)
        const allFoundIds = [...coreIds, ...extendedRelatives.map(m => m._id)];
        
        const marriages = await Marriage.find({
            status: 'Active',
            $or: [
                { husbandId: { $in: allFoundIds } },
                { wifeId: { $in: allFoundIds } }
            ]
        });

        // 5. Fetch Missing Spouses
        const spouseIds = [];
        marriages.forEach(m => {
            spouseIds.push(m.husbandId);
            spouseIds.push(m.wifeId);
        });

        // Filter out IDs we already have
        const knownIdSet = new Set(allFoundIds.map(id => id.toString()));
        const uniqueSpouseIds = [...new Set(spouseIds.map(id => id.toString()))]
            .filter(id => !knownIdSet.has(id));

        const spouses = await Member.find({ _id: { $in: uniqueSpouseIds } });

        // 6. Assemble & Link
        let allMembers = [...coreFamily, ...extendedRelatives, ...spouses];
        
        // Remove duplicates (by memberId or _id)
        const memberMap = new Map();
        allMembers.forEach(m => memberMap.set(m.memberId, m.toObject()));

        // DYNAMIC LINKING: Inject spouseId based on Marriages
        marriages.forEach(m => {
            const h = memberMap.get(m.husbandId.toString()) || Array.from(memberMap.values()).find(x => x._id.toString() === m.husbandId.toString());
            const w = memberMap.get(m.wifeId.toString()) || Array.from(memberMap.values()).find(x => x._id.toString() === m.wifeId.toString());

            if (h && w) {
                h.spouseId = w._id;
                w.spouseId = h._id;
            }
        });

        const uniqueMembers = Array.from(memberMap.values());

        // 7. Attach User Permissions
        const familyData = await Promise.all(uniqueMembers.map(async (member) => {
            const user = await User.findOne({ memberId: member.memberId }).select('username role permissions isVerified');
            return {
                member: member,
                user: user || null
            };
        }));

        res.json({
            familyId: currentMember.familyId,
            isPrimary: currentMember.isPrimary,
            members: familyData
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/family/permissions/{targetMemberId}:
 *   put:
 *     summary: Update family member permissions
 *     tags: [Family]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: targetMemberId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Permissions updated
 */
router.put('/permissions/:targetMemberId', verifyToken, async (req, res) => {
    try {
        const myMemberId = req.user.memberId;
        const targetMemberId = req.params.targetMemberId;
        const { permissions } = req.body; // e.g., ['edit_profile', 'view_family']

        // 1. Verify Requestor is Primary
        const me = await Member.findOne({ memberId: myMemberId });
        if (!me || !me.isPrimary) {
            return res.status(403).json({ message: 'Access Denied: Only the Primary Member can manage permissions' });
        }

        // 2. Verify Target is in SAME Family
        const targetMember = await Member.findOne({ memberId: targetMemberId });
        if (!targetMember) return res.status(404).json({ message: 'Target member not found' });

        if (targetMember.familyId !== me.familyId) {
            return res.status(403).json({ message: 'Access Denied: You can only manage your own family' });
        }

        // 3. Update Target User Permissions
        const targetUser = await User.findOne({ memberId: targetMemberId });
        if (!targetUser) return res.status(404).json({ message: 'User account not found for this member' });

        targetUser.permissions = permissions;
        await targetUser.save();

        res.json({ message: 'Permissions updated successfully', permissions: targetUser.permissions });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/family/tree-data/{memberId}:
 *   get:
 *     summary: Get complete family tree data for a specific member
 *     tags: [Family]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of family members for the tree
 */
router.get('/tree-data/:memberId', verifyToken, async (req, res) => {
    try {
        const { memberId } = req.params;

        // 1. Fetch Target Member
        let targetMember;
        if (mongoose.Types.ObjectId.isValid(memberId)) {
            targetMember = await Member.findById(memberId);
        }
        if (!targetMember) {
            targetMember = await Member.findOne({ memberId: memberId });
        }

        if (!targetMember) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // 2. Fetch Core Family (Birth Family)
        let coreFamily = [];
        if (targetMember.familyId && targetMember.familyId !== 'Unassigned' && targetMember.familyId !== 'FNew') {
            coreFamily = await Member.find({ familyId: targetMember.familyId });
        } else {
            coreFamily = [targetMember];
        }

        const coreIds = coreFamily.map(m => m._id);

        // 3. Extended Search: Descendants of Core who are in different families
        // (e.g. Children of Married Daughters)
        const distinctFamilyDescendants = await Member.find({
            familyId: { $ne: targetMember.familyId },
            $or: [
                { fatherId: { $in: coreIds } },
                { motherId: { $in: coreIds } }
            ]
        });

        const descendantsIds = distinctFamilyDescendants.map(m => m._id);

        // 3.5 Level 2: Grandchildren (Children of the descendants found above)
        let level2Descendants = [];
        if (descendantsIds.length > 0) {
            level2Descendants = await Member.find({
                 familyId: { $ne: targetMember.familyId }, // Optimization
                 $or: [
                    { fatherId: { $in: descendantsIds } },
                    { motherId: { $in: descendantsIds } }
                ]
            });
        }

        // 4. Marriages
        // We need marriages for EVERYONE found so far to display spouses
        const allSubjectIds = [
            ...coreIds, 
            ...descendantsIds, 
            ...level2Descendants.map(m => m._id)
        ];

        const marriages = await Marriage.find({
            status: 'Active',
            $or: [
                { husbandId: { $in: allSubjectIds } },
                { wifeId: { $in: allSubjectIds } }
            ]
        });

        // 5. Fetch Spouses who are not yet in our list
        const spouseIds = [];
        marriages.forEach(m => {
            spouseIds.push(m.husbandId);
            spouseIds.push(m.wifeId);
        });

        const knownIdSet = new Set(allSubjectIds.map(id => id.toString()));
        const uniqueSpouseIds = [...new Set(spouseIds.map(id => id.toString()))]
            .filter(id => !knownIdSet.has(id));

        const spouses = await Member.find({ _id: { $in: uniqueSpouseIds } });

        // 6. Merge & Construct Response
        const allMembers = [
            ...coreFamily, 
            ...distinctFamilyDescendants, 
            ...level2Descendants, 
            ...spouses
        ];

        // Convert to Plain Objects to allow mutation
        const memberMap = new Map();
        allMembers.forEach(m => memberMap.set(m._id.toString(), m.toObject()));

        // Dynamic Linking of Spouse IDs
        marriages.forEach(m => {
            const hId = m.husbandId.toString();
            const wId = m.wifeId.toString();
            
            const h = memberMap.get(hId);
            const w = memberMap.get(wId);

            if (h && w) {
                h.spouseId = m.wifeId;
                w.spouseId = m.husbandId;
            }
        });

        const finalMemberList = Array.from(memberMap.values());

        res.json(finalMemberList);

    } catch (err) {
        console.error("Tree Data Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// MIGRATION ROUTE (Temporary)
router.post('/migrate-marriages', async (req, res) => {
    try {
        console.log('Starting Marriage Migration...');
        const membersWithSpouse = await Member.find({ 
            spouseId: { $ne: null },
            // Optional: Filter those who don't have marriage records?
            // Easier to just upsert all.
        });

        let count = 0;
        for (const m of membersWithSpouse) {
            // Check if we have a valid spouse linked
            // Prevent self-linking or invalid IDs
            if (!m.spouseId || m.spouseId.toString() === m._id.toString()) continue;

            const existingMarriage = await Marriage.findOne({
                $or: [
                    { husbandId: m._id, wifeId: m.spouseId },
                    { husbandId: m.spouseId, wifeId: m._id }
                ]
            });

            if (!existingMarriage) {
                // Determine Husband/Wife based on Gender
                // Fallback: If gender missing, assume current is Husband if not 'Female'
                const isMale = m.gender === 'Male';
                
                await Marriage.create({
                    husbandId: isMale ? m._id : m.spouseId,
                    wifeId: isMale ? m.spouseId : m._id,
                    status: 'Active'
                });
                count++;
            }
        }
        console.log(`Migration Complete. Created ${count} marriage records.`);
        res.json({ message: `Migration Complete. Created ${count} marriage records.` });
    } catch (err) {
        console.error('Migration Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
