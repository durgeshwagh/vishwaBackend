const express = require('express');
const Member = require('../models/Member');
const Marriage = require('../models/Marriage');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const cacheService = require('../services/cache.service');
const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Member:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - gender
 *         - maritalStatus
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the member
 *         firstName:
 *           type: string
 *           description: The first name of the member
 *         lastName:
 *           type: string
 *           description: The last name of the member
 *         gender:
 *           type: string
 *           enum: [Male, Female]
 *         maritalStatus:
 *           type: string
 *           enum: [Single, Married]
 *         memberId:
 *           type: string
 *           description: Custom generated member ID (e.g. M123456)
 *         familyId:
 *           type: string
 *           description: The family ID this member belongs to
 *       example:
 *         firstName: John
 *         lastName: Doe
 *         gender: Male
 *         maritalStatus: Single
 */

// Multer Configuration (Disk Storage for Optimization)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Wrapper to handle Multer errors
const uploadMiddleware = (fields) => (req, res, next) => {
    const uploadStep = upload.fields(fields);
    uploadStep(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            console.error('[Multer Error]', err);
            return res.status(400).json({ message: 'File Upload Error: ' + err.message, code: err.code });
        } else if (err) {
            // An unknown error occurred when uploading.
            console.error('[Upload Error]', err);
            return res.status(500).json({ message: 'Unknown Upload Error: ' + err.message });
        }
        // Everything went fine.
        next();
    });
};

/**
 * @swagger
 * /api/members:
 *   get:
 *     summary: Returns the list of all members
 *     tags: [Members]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, occupation, city, etc.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: The list of members
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Member'
 */
// Get All Members (Search/Filter support & Pagination)
// Get All Members (Search/Filter support & Pagination)
router.get('/', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        const { search, familyId, isPrimary } = req.query;
        const page = parseInt(req.query.page) || 1;
        // If limit is explicitly '0', use 0 (no limit). Otherwise default to 20.
        const limitParam = req.query.limit;
        const limit = limitParam === '0' ? 0 : (parseInt(limitParam) || 20);

        // If limit is 0, skip is 0.
        const skip = limit === 0 ? 0 : (page - 1) * limit;

        let query = {};
        
        // Default: Only show Alive members unless explicitly asked otherwise
        if (!req.query.showDeceased || req.query.showDeceased.toString().toLowerCase() !== 'true') {
            query['personal_info.life_status'] = { $ne: 'Deceased' };
        }

        // Filter by Primary Status if requested
        let isPrimaryBool = false;
        if (isPrimary && isPrimary.toString().toLowerCase().trim() === 'true') {
            query.isPrimary = true;
            isPrimaryBool = true;
            console.log('[DEBUG] Filtering by Primary Member Status');
        }

        // Filter by Matrimony Privacy Flag
        const { showOnMatrimony, gender, maritalStatus } = req.query;
        if (showOnMatrimony && showOnMatrimony.toString().toLowerCase().trim() === 'true') {
            // Target the correct nested path in MongoDB
            query['personal_info.showOnMatrimony'] = true;
            console.log('[DEBUG] Filtering for Matrimony Portal (Visible Only)');
        }

        // Gender Filter (Exact Match)
        if (gender) {
            query.gender = gender.trim(); 
        }

        // Marital Status Filter (Exact Match)
        if (maritalStatus) {
            query.maritalStatus = maritalStatus.trim();
        }

        // ROLE-BASED ACCESS CONTROL
        const userRole = req.user.role; // 'Member', 'Admin', 'SuperAdmin'

        if (userRole === 'Admin' || userRole === 'SuperAdmin') {
            // ADMIN: Can see everyone, or filter by specific family if requested
            if (familyId) {
                query.familyId = familyId;
            }
        } else {
            // MEMBER: 
            // If fetching Primary Members (Directory), allow seeing all Primary Members
            if (isPrimaryBool) {
                // No restriction on familyId, they can see all heads
                // But we might want to respect search/pagination below
            } else {
                // RESTRICTED: Can ONLY see their own family
                // Fetch the logged-in user's full member profile to determine their family
                /* 
                let myMemberProfile = null;
                if (req.user.memberId) {
                    myMemberProfile = await Member.findOne({ memberId: req.user.memberId });
                }

                if (myMemberProfile && myMemberProfile.familyId) {
                    query.familyId = myMemberProfile.familyId;
                } else {
                    if (req.user.memberId) {
                        query.memberId = req.user.memberId; // Only see themselves
                    } else {
                        // Return empty paginated structure
                        return res.json({ data: [], total: 0, page, pages: 0 });
                    }
                }
                */
                // TEMPORARY: Allow all members to see the list until RBAC is fully defined
            }
        }

        const andConditions = [];

        // Helper to escape regex special characters
        function escapeRegex(text) {
            return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        }

        if (search) {
            const safeSearch = escapeRegex(search.trim());
            
            // 1. Regex Search (Partial matches)
            const searchRegex = new RegExp(safeSearch, 'i');

            // Optimization: If search term looks like a Member ID (M1234), prioritize ID search
            if (/^M\d+$/i.test(search.trim())) {
                 andConditions.push({ memberId: searchRegex });
            } else {
                 andConditions.push({
                    $or: [
                        { fullName: searchRegex }, 
                        { firstName: searchRegex },
                        { lastName: searchRegex },
                        { city: searchRegex },
                        { village: searchRegex },
                        { phone: searchRegex }
                    ]
                 });
            }
        }

        // Advanced Filters (AND logic)
        const { name, state, district, city, village } = req.query; 
        // Single Input Name Filter (Matches First OR Middle OR Last OR Full Name)
        if (name) {
            const safeName = escapeRegex(name.trim());
            const fullNamePattern = safeName.replace(/\s+/g, '\\s*');
            const fullNameRegex = new RegExp(fullNamePattern, 'i');
            const nameRegex = new RegExp(safeName, 'i');

            andConditions.push({
                $or: [
                    { fullName: fullNameRegex },
                    { firstName: nameRegex },
                    { lastName: nameRegex }
                ]
            });
        }

        // Single Input Location Filter (Matches State OR District OR City OR Village)
        const { location } = req.query;
        if (location) {
            const safeLoc = escapeRegex(location.trim());
            const locRegex = new RegExp(safeLoc, 'i');
            andConditions.push({
                $or: [
                    { city: locRegex },
                    { village: locRegex },
                    { district: locRegex },
                    { state: locRegex }
                ]
            });
        }

        // Contact Filter (Matches Phone)
        const { contact } = req.query;
        if (contact) {
            const contactRegex = new RegExp(escapeRegex(contact.trim()), 'i');
            andConditions.push({ phone: contactRegex });
        }


        if (state) {
            const safeState = escapeRegex(state.trim());
            const stateRegex = new RegExp(safeState, 'i');
            andConditions.push({
                $or: [
                    { state: stateRegex },
                    { stateName: stateRegex },
                    { 'geography.state': stateRegex }
                ]
            });
        }
        if (district) {
            const safeDistrict = escapeRegex(district.trim());
            const districtRegex = new RegExp(safeDistrict, 'i');
            andConditions.push({
                $or: [
                    { district: districtRegex },
                    { districtName: districtRegex },
                    { 'geography.district': districtRegex }
                ]
            });
        }
        if (city) {
            const safeCity = escapeRegex(city.trim());
            const cityRegex = new RegExp(safeCity, 'i');
            andConditions.push({
                $or: [
                    { city: cityRegex },
                    { taluka: cityRegex },
                    { talukaName: cityRegex },
                    { 'geography.taluka': cityRegex }
                ]
            });
        }
        if (village) {
            const safeVillage = escapeRegex(village.trim());
            const villageRegex = new RegExp(safeVillage, 'i');
            andConditions.push({
                $or: [
                    { village: villageRegex },
                    { villageName: villageRegex },
                    { 'geography.village': villageRegex }
                ]
            });
        }
        if (req.query.fatherId) query.fatherId = req.query.fatherId;
        if (req.query.motherId) query.motherId = req.query.motherId;

        // Apply AND conditions if any
        if (andConditions.length > 0) {
            query.$and = andConditions;
        }

        // Sorting
        const { sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Ensure 'createdAt' is indexed for this sort to be fast.

        console.log('--- GET /members Debug ---');
        console.log('User:', req.user.username); // Log simplified user
        console.log('Query Params:', req.query);
        console.log('AND Conditions:', JSON.stringify(andConditions, null, 2)); // Log AND conditions
        console.log('Final Mongo Query:', JSON.stringify(query, null, 2));

        // PERFORMANCE OPTIMIZATION: Execute count and find queries in parallel
        const [total, members] = await Promise.all([
            Member.countDocuments(query),
            Member.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        // Check registration status for each member
        const memberIds = members.map(m => m.memberId);
        const registeredUsers = await require('../models/User').find({ memberId: { $in: memberIds } }).select('memberId').lean();
        const registeredMemberIds = new Set(registeredUsers.map(u => u.memberId));

        const membersWithStatus = members.map(m => ({
            ...m,
            isRegistered: registeredMemberIds.has(m.memberId)
        }));

        res.json({
            data: membersWithStatus,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalMembers: total
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


/**
 * @swagger
 * /api/members/{id}:
 *   get:
 *     summary: Get member by ID
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member details
 *       404:
 *         description: Member not found
 */
router.get('/:id', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        const idParam = req.params.id;
        console.log(`[DEBUG] GET /members/:id called with id: ${idParam}`);

        let member;

        if (idParam.startsWith('M')) {
            console.log(`[DEBUG] Detected Custom ID. Searching by memberId.`);
            // Assume it's a custom Member ID
            member = await Member.findOne({ memberId: idParam });
        } else {
            console.log(`[DEBUG] Detected Mongo ID. Searching by _id.`);
            // Assume it's a Mongo ID
            member = await Member.findById(idParam);
        }

        if (!member) {
            console.log(`[DEBUG] Member not found.`);
            return res.status(404).json({ message: 'Member not found' });
        }
        res.json(member);
    } catch (err) {
        console.error(`[DEBUG] Error in GET /members/:id:`, err.message);

        // Fallback: If findById fails (e.g. invalid format), try findOne by memberId just in case
        try {
            const memberFallback = await Member.findOne({ memberId: req.params.id });
            if (memberFallback) return res.json(memberFallback);
        } catch (ignore) { }

        res.status(500).json({ error: err.message });
    }
});

// Helper to generate IDs
// Helper Functions (Global Scope)
async function generateMemberId() {
    const lastMember = await Member.findOne({ memberId: /^M\d+$/ }).sort({ memberId: -1 });
    if (lastMember && lastMember.memberId) {
        // Extract number from M0001
        const num = parseInt(lastMember.memberId.substring(1)) + 1;
        return `M${num.toString().padStart(4, '0')}`;
    }
    return 'M0001';
}

async function generateFamilyId() {
    const lastMember = await Member.findOne({ familyId: /^F\d+$/ }).sort({ familyId: -1 });
    if (lastMember && lastMember.familyId) {
        const num = parseInt(lastMember.familyId.substring(1)) + 1;
        return `F${num.toString().padStart(4, '0')}`;
    }
    return 'F0001';
}

// Helper to Map Flat Payload to Nested Schema (Supports Dot Notation for safe updates)
function mapFlatToNested(payload) {
    // Helper to safely trim and collapse multiple spaces
    const clean = (val) => (typeof val === 'string' ? val.trim().replace(/\s+/g, ' ') : val);

    const result = { ...payload };

    // 1. Map Main Names
    if (payload.firstName !== undefined) {
        const fn = clean(payload.firstName);
        result['personal_info.names.first_name'] = fn;
        result.firstName = fn;
    }
    if (payload.middleName !== undefined) {
        const mn = clean(payload.middleName);
        result['personal_info.names.middle_name'] = mn;
        result.middleName = mn;
    }
    if (payload.lastName !== undefined) {
        const ln = clean(payload.lastName);
        result['personal_info.names.last_name'] = ln;
        result.lastName = ln;
    }
    if (payload.prefix !== undefined) {
        result['personal_info.names.prefix'] = payload.prefix;
        result.prefix = payload.prefix;
    }
    if (payload.lifeStatus !== undefined) {
        result['personal_info.life_status'] = payload.lifeStatus;
        result.lifeStatus = payload.lifeStatus;
    }

    // 2. Full Name Calculation (Backend Force)
    const f = clean(payload.firstName || '');
    const m = clean(payload.middleName || '');
    const l = clean(payload.lastName || '');
    const p = clean(payload.prefix || '');
    if (f && l) {
        result.fullName = `${p ? p + ' ' : ''}${f} ${m ? m + ' ' : ''}${l}`.replace(/\s+/g, ' ').trim();
    }

    // 3. Spouse Name Mapping (Explicit construction)
    let sfn = clean(payload.spouseName || '');
    const smn = clean(payload.spouseMiddleName || '');
    const sln = clean(payload.spouseLastName || '');
    const sp = clean(payload.spousePrefix || '');

    // Fallback: If spouseDetails part of payload (common in recursive), 
    // we use them to ensure spouseName is set at root
    if (!sfn && payload.spouse) {
        const sd = typeof payload.spouse === 'string' ? JSON.parse(payload.spouse) : payload.spouse;
        sfn = clean(sd.firstName || sd.spouseName || '');
    }

    if (sfn) {
        result.spouseName = sfn;
        result.spouseMiddleName = smn; // FIXED: Ensure propagated
        result.spouseLastName = sln;
        result.spousePrefix = sp;
        
        // Calculate Spouse Full Name
        result.spouseFullName = `${sp ? sp + ' ' : ''}${sfn} ${smn ? smn + ' ' : ''}${sln}`.replace(/\s+/g, ' ').trim();
    }

    // 4. Details & Bio
    if (payload.dob) {
        result['personal_info.dob'] = payload.dob;
        result.dob = payload.dob;
    }
    if (payload.gender) {
        result['personal_info.gender'] = payload.gender;
        result.gender = payload.gender;
    }
    if (payload.occupation) {
        result['personal_info.biodata.occupation'] = clean(payload.occupation);
        result.occupation = clean(payload.occupation);
    }
    if (payload.education) {
        result['personal_info.biodata.education'] = clean(payload.education);
        result.education = clean(payload.education);
    }
    if (payload.height) {
        result['personal_info.biodata.height'] = clean(payload.height);
        result.height = clean(payload.height);
    }
    if (payload.phone || payload.mobile) {
        const ph = clean(payload.phone || payload.mobile);
        result['personal_info.biodata.contact.mobile'] = ph;
        result.phone = ph;
    }
    if (payload.email) {
        const em = clean(payload.email);
        result['personal_info.biodata.contact.email'] = em;
        result.email = em;
    }

    // 5. Geography
    if (payload.state) result['geography.state'] = payload.state;
    if (payload.district) result['geography.district'] = payload.district;
    if (payload.city || payload.taluka) result['geography.taluka'] = payload.city || payload.taluka;
    if (payload.village) result['geography.village'] = payload.village;
    if (payload.address) result['geography.full_address'] = clean(payload.address);

    // 6. Matrimony Privacy Flag
    if (payload.showOnMatrimony !== undefined) {
        // Handle string 'true'/'false' from FormData
        const isMarried = payload.maritalStatus === 'Married';
        const isDeceased = (payload.lifeStatus === 'Deceased' || payload.prefix === 'Late');
        const val = !isMarried && !isDeceased && String(payload.showOnMatrimony).toLowerCase() === 'true';
        result['personal_info.showOnMatrimony'] = val;
        result.showOnMatrimony = val; // Also set at root if needed for virtuals/legacy, but strictly it's in personal_info
    }

    // 7. Resolved Names (Persist to root for easy display/search)
    if (payload.fullName) result.fullName = payload.fullName;
    if (payload.stateName) result.stateName = payload.stateName;
    if (payload.districtName) result.districtName = payload.districtName;
    if (payload.talukaName) result.talukaName = payload.talukaName;
    if (payload.villageName) result.villageName = payload.villageName;

    // 8. Photo URLs (Explicitly Persist)
    if (payload.photoUrl) result.photoUrl = payload.photoUrl;
    if (payload.spousePhotoUrl) result.spousePhotoUrl = payload.spousePhotoUrl;

    return result;
}

// Recursive Upsert Helper
async function upsertMemberRecursive(memberData, context = {}) {
    try {
        // Map Flat -> Nested FIRST
        let data = mapFlatToNested({ ...memberData });

        // Inherit Context
        if (context.familyId) data.familyId = context.familyId;
        if (context.fatherId) data.fatherId = context.fatherId;
        if (context.motherId) data.motherId = context.motherId;

        // Upsert Main Member
        let savedMember;
        const existsId = data.id || data._id;

        if (existsId) {
            savedMember = await Member.findByIdAndUpdate(existsId, data, { new: true });
        } else {
            if (!data.memberId) data.memberId = await generateMemberId();
            // Default surname if missing
            if (!data.lastName && context.lastName) data.lastName = context.lastName;

            savedMember = await new Member(data).save();
        }

        if (!savedMember) return null;

        // Handle Spouse (Upsert) - If provided in payload
        if (data.spouse) {
            let spouseData = typeof data.spouse === 'string' ? JSON.parse(data.spouse) : data.spouse;

            // CRITICAL CHANGE (User Request): Spouse inherits Member's Family ID (Same Household)
            // Unless explicitly provided (which implies Birth Family context), spouse joins the member's family unit.
            if (!spouseData.familyId) spouseData.familyId = savedMember.familyId;

            // Map Spouse Data Flat -> Nested
            spouseData = mapFlatToNested(spouseData);
            console.log("DEBUG: Spouse Data after mapping:", JSON.stringify(spouseData, null, 2));

            // REMOVED: spouseData.spouseId = savedMember._id; // Do not store explicit link on Member

            spouseData.city = spouseData.city || savedMember.city;
            spouseData.village = spouseData.village || savedMember.village;
            if (data.spousePhotoUrl) spouseData.photoUrl = data.spousePhotoUrl;

            // Inherit Last Name if standard (Wife takes Husband's name? User said: "relationships are not maintained correctly", but didn't ban name changes)
            // But usually name change is fine. 
            if (!spouseData.lastName) spouseData.lastName = savedMember.lastName;

            let savedSpouse;

            // Check if Marriage exists
            // We need to find if there is an existing spouse for this member? 
            // Or if we are updating a specific spouse passed in spouseData (if it has ID)

            if (spouseData.id || spouseData._id) {
                savedSpouse = await Member.findByIdAndUpdate(spouseData.id || spouseData._id, spouseData, { new: true });
            } else {
                // [FIX duplicate spouses] Check if ANY active marriage exists for this member? 
                const existingMarriage = await Marriage.findOne({
                    $or: [{ husbandId: savedMember._id }, { wifeId: savedMember._id }],
                    status: 'Active'
                });

                if (existingMarriage) {
                    const existingSpouseId = existingMarriage.husbandId.toString() === savedMember._id.toString() 
                        ? existingMarriage.wifeId 
                        : existingMarriage.husbandId;
                    
                    console.log(`[Duplicate Prevention] Found existing spouse ${existingSpouseId} via Marriage record.`);
                    spouseData._id = existingSpouseId; // Treat as Update
                    savedSpouse = await Member.findByIdAndUpdate(existingSpouseId, spouseData, { new: true });
                }
                
                // If still no spouse found, verify if we accidentally created one previously without linking?
                // For now, proceed to create new.
                if (!savedSpouse) {
                    if (!spouseData.memberId) spouseData.memberId = await generateMemberId();
                    const newSpouse = new Member(spouseData);
                    savedSpouse = await newSpouse.save();
                }
            }

            // Create/Update Marriage Record
            if (savedSpouse) {
                const marriage = await Marriage.findOneAndUpdate(
                    {
                        $or: [
                            { husbandId: savedMember._id, wifeId: savedSpouse._id },
                            { husbandId: savedSpouse._id, wifeId: savedMember._id }
                        ]
                    },
                    {
                        husbandId: savedMember.gender === 'Male' ? savedMember._id : savedSpouse._id,
                        wifeId: savedMember.gender === 'Female' ? savedMember._id : savedSpouse._id,
                        status: 'Active'
                    },
                    { upsert: true, new: true }
                );

                // CRITICAL: Explicitly link on Member (Legacy Field) for Frontend
                savedMember.spouseId = savedSpouse._id;
                savedSpouse.spouseId = savedMember._id;

                await savedMember.save();
                await savedSpouse.save();
            }
        }

        // Handle Children (Recursive)
        if (data.children) {
            const childrenData = typeof data.children === 'string' ? JSON.parse(data.children) : data.children;

            if (Array.isArray(childrenData) && childrenData.length > 0) {
                // Optimization: Process children in parallel instead of sequential await
                console.log(`[Performance] Processing ${childrenData.length} children in parallel`);
                await Promise.all(childrenData.map(async (child) => {
                    const childContext = {
                        familyId: savedMember.familyId, // Children inherit birth family from parent (Linkage)
                        fatherId: savedMember.gender === 'Male' ? savedMember._id : null, 
                        motherId: savedMember.gender === 'Female' ? savedMember._id : null,
                        lastName: savedMember.lastName
                    };
                    return upsertMemberRecursive(child, childContext);
                }));
            }
        }

        return savedMember;
    } catch (err) {
        console.error("Recursive Upsert Error:", err);
        throw err;
    }
}

/**
 * @swagger
 * /api/members:
 *   post:
 *     summary: Create a new member
 *     tags: [Members]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Member'
 *     responses:
 *       201:
 *         description: The member was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Member'
 *       500:
 *         description: Some server error
 */
/**
 * @swagger
 * /api/members:
 *   post:
 *     summary: Create a new member
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Member'
 *     responses:
 *       201:
 *         description: Member created
 */
router.post('/', verifyToken, checkPermission('member.create'), uploadMiddleware([{ name: 'photo', maxCount: 1 }, { name: 'spousePhoto', maxCount: 1 }]), async (req, res) => {
    try {
        const payload = req.body;

        // Fix for Multer Array issue (if familyId is sent multiple times)
        if (Array.isArray(payload.familyId)) {
            payload.familyId = payload.familyId[payload.familyId.length - 1];
        }

        // 0. Duplicate Check (Prevent duplicates for children)
        if (payload.firstName && payload.lastName && (payload.fatherId || payload.motherId)) {
            const duplicateCheck = await Member.findOne({
                firstName: new RegExp(`^${payload.firstName}$`, 'i'),
                lastName: new RegExp(`^${payload.lastName}$`, 'i'),
                $or: [{ fatherId: payload.fatherId }, { motherId: payload.motherId }]
            });
            if (duplicateCheck) {
                return res.status(409).json({ message: 'A child with this name already exists for this parent.' });
            }
        }

        // 1. Auto-Generate memberId
        payload.memberId = await generateMemberId();

        // 2. Family ID Logic
        // If Family ID is not provided or is 'FNew', we assume this is a new Family Head or Independent Member.
        // We generate a new Family ID.
        if (!payload.familyId || payload.familyId === 'FNew') {
            payload.familyId = await generateFamilyId();
        }



        // Handle File Upload (Disk Storage - Store relative path)
        if (req.files) {
            if (req.files['photo']) {
                payload.photoUrl = `uploads/${req.files['photo'][0].filename}`;
            }
            if (req.files['spousePhoto']) {
                payload.spousePhotoUrl = `uploads/${req.files['spousePhoto'][0].filename}`;
            }
        }

        // Map Payload to Nested Mongoose Schema
        // (The Frontend sends flat structure, but Model requires nested 'personal_info')
        if (!payload.personal_info) {
            payload.personal_info = {
                names: {
                    first_name: payload.firstName,
                    middle_name: payload.middleName,
                    last_name: payload.lastName,
                    prefix: payload.prefix, // Ensure prefix is mapped
                    maiden_name: payload.maidenName // Assuming frontend sends this if needed
                },
                dob: payload.dob,
                gender: payload.gender,
                life_status: payload.lifeStatus || 'Alive', // Use payload or default to Alive
                showOnMatrimony: payload.maritalStatus !== 'Married' && String(payload.showOnMatrimony).toLowerCase() === 'true' && (payload.lifeStatus !== 'Deceased'), // Add Matrimony Flag (Only for Single/Divorced/Widowed and ALIVE)
                biodata: {
                    education: payload.education,
                    height: payload.height,
                    occupation: payload.occupation,
                    contact: {
                        mobile: payload.mobile || payload.phone,
                        email: payload.email
                    }
                }
            };
        }
        if (!payload.geography) {
            payload.geography = {
                state: payload.state,
                district: payload.district,
                taluka: payload.city || payload.taluka,
                village: payload.village,
                full_address: payload.address
            };
        }

        // Calculate Main Member Full Name (Backend Force)
        const p = payload.prefix ? payload.prefix.trim() : '';
        const f = payload.firstName ? payload.firstName.trim() : '';
        const m = payload.middleName ? payload.middleName.trim() : '';
        const l = payload.lastName ? payload.lastName.trim() : '';
        
        if (f && l) {
            payload.fullName = `${p ? p + ' ' : ''}${f} ${m ? m + ' ' : ''}${l}`.replace(/\s+/g, ' ').trim();
        }

        // Calculate Spouse Full Name (for persistence)
        if (payload.spouseName) {
            const sp = payload.spousePrefix ? payload.spousePrefix.trim() : '';
            const sfn = (payload.spouseName || '').trim();
            const smn = (payload.spouseMiddleName || '').trim();
            const sln = (payload.spouseLastName || '').trim();
            payload.spouseFullName = `${sp ? sp + ' ' : ''}${sfn} ${smn ? smn + ' ' : ''}${sln}`.replace(/\s+/g, ' ').trim();
        }

        const newMember = new Member(payload);

        // Auto-set Primary if creating a New Family
        if (payload.familyId && payload.familyId.startsWith('F') && !payload.familyId.startsWith('FNew')) {
            // If joining existing family, check if anyone else is primary? 
            // Logic: If user specifically sets FamilyID, we assume they might not be primary unless specified.
            // But for 'FNew' logic handled above:
        }

        // Logic: if we generated a NEW family ID, this person is likely the Primary
        // We can infer this if they are 'Head' or 'Married' Male starting a family
        // Simple rule: If familyId was generated in this request, set isPrimary = true
        // Re-checking the familyId generation logic above...

        // Let's refine: If payload.familyId was JUST generated (it wasn't in list of existing families), they are primary.
        // Easier: Check if any other member exists with this familyId. If not, this is the first -> Primary.
        const existingFamilyMembers = await Member.countDocuments({ familyId: payload.familyId });
        if (existingFamilyMembers === 0) {
            newMember.isPrimary = true;
        }

        const savedMember = await newMember.save();
        
        // Invalidate Dashboard Cache
        cacheService.del(cacheService.KEYS.DASHBOARD_STATS);

        // ---------------------------------------------------------
        // HANDLE MARRIAGE LINKING (If spouseId provided)
        // ---------------------------------------------------------
        if (payload.spouseId) {
            const spouse = await Member.findById(payload.spouseId);
            if (spouse) {
                await Marriage.create({
                    husbandId: savedMember.gender === 'Male' ? savedMember._id : spouse._id,
                    wifeId: savedMember.gender === 'Female' ? savedMember._id : spouse._id,
                    status: 'Active'
                });
                console.log(`Created Marriage between ${savedMember.firstName} and ${spouse.firstName}`);
            }
        }

        // ---------------------------------------------------------
        // AUTO-CREATE SPOUSE (If Married and Spouse Name Provided)
        // ---------------------------------------------------------
        // ---------------------------------------------------------
        // AUTO-CREATE SPOUSE (If Married and Spouse Name Provided)
        // ---------------------------------------------------------
        if (payload.maritalStatus === 'Married' && payload.spouseName) {
            try {
                const spousePayload = {
                    memberId: await generateMemberId(),
                    personal_info: {
                        names: {
                            first_name: payload.spouseName,
                            middle_name: payload.spouseMiddleName || '',
                            last_name: payload.spouseLastName || (payload.gender === 'Male' ? payload.lastName : ''),
                            prefix: payload.spousePrefix, // Ensure prefix is mapped
                        },
                        dob: payload.spouseDob || payload.dob,
                        gender: payload.spouseGender || (payload.gender === 'Male' ? 'Female' : 'Male'),
                        life_status: 'Alive',
                        biodata: {} // Add any other bio fields if available
                    },
                    geography: {
                        state: payload.state,
                        district: payload.district,
                        taluka: payload.city || payload.taluka,
                        village: payload.village,
                        full_address: payload.address
                    },
                    maritalStatus: 'Married',
                    familyId: savedMember.familyId, // Inherit Family ID (Part of same household/tree)
                    photoUrl: payload.spousePhotoUrl,
                    // Legacy fields for backward compatibility
                    firstName: payload.spouseName,
                    middleName: payload.spouseMiddleName || '', // FIXED: Added root middleName
                    lastName: payload.spouseLastName || (payload.gender === 'Male' ? payload.lastName : ''),
                    gender: payload.spouseGender || (payload.gender === 'Male' ? 'Female' : 'Male'),
                    dob: payload.spouseDob || payload.dob,
                    
                    // Calculate Spouse's Own Full Name
                    fullName: `${payload.spousePrefix ? payload.spousePrefix.trim() + ' ' : ''}${payload.spouseName} ${payload.spouseMiddleName ? payload.spouseMiddleName.trim() + ' ' : ''}${payload.spouseLastName || (payload.gender === 'Male' ? payload.lastName : '')}`.replace(/\s+/g, ' ').trim(),
                    
                    // Reciprocal Spouse Details (So the spouse record points back to the main member)
                    spouseName: savedMember.firstName,
                    spouseMiddleName: savedMember.middleName,
                    spouseLastName: savedMember.lastName,
                    spouseFullName: savedMember.fullName || `${savedMember.firstName} ${savedMember.middleName ? savedMember.middleName + ' ' : ''}${savedMember.lastName}`.trim(),
                };

                let savedSpouse;

                // [Duplicate Prevention] Check for Existing Marriage
                const existingMarriage = await Marriage.findOne({
                    $or: [{ husbandId: savedMember._id }, { wifeId: savedMember._id }],
                    status: 'Active'
                });

                if (existingMarriage) {
                    const existingSpouseId = existingMarriage.husbandId.toString() === savedMember._id.toString() 
                        ? existingMarriage.wifeId 
                        : existingMarriage.husbandId;
                    
                    console.log(`[POST] Found existing spouse ${existingSpouseId} via Marriage record. Linking...`);
                    // Update existing spouse if needed, or just link
                    savedSpouse = await Member.findById(existingSpouseId);
                    // update fields if we want to sync? For now just link.
                } else {
                    // Create New Spouse
                    const newSpouse = new Member(spousePayload);
                    savedSpouse = await newSpouse.save();
                    console.log(`Auto-created Spouse Member: ${savedSpouse.firstName} (${savedSpouse.memberId}) linked to ${savedMember.memberId}`);

                    // Create Marriage
                    await Marriage.create({
                        husbandId: savedMember.gender === 'Male' ? savedMember._id : savedSpouse._id,
                        wifeId: savedMember.gender === 'Female' ? savedMember._id : savedSpouse._id,
                        status: 'Active'
                    });
                }

                // CRITICAL: Explicitly link on Member (Legacy Field)
                if (savedSpouse) {
                    savedMember.spouseId = savedSpouse._id;
                    savedSpouse.spouseId = savedMember._id; // Bi-directional
                    
                    await savedMember.save();
                    await savedSpouse.save();
                }

            } catch (spouseErr) {
                console.error('Failed to auto-create spouse member:', spouseErr.message);
            }
        }

        // ---------------------------------------------------------
        // HANDLE FAMILY LINEAGE LINKS (New Relationship Structure)
        // ---------------------------------------------------------
        if (payload.family_lineage_links) {
            try {
                const links = typeof payload.family_lineage_links === 'string'
                    ? JSON.parse(payload.family_lineage_links)
                    : payload.family_lineage_links;

                // Ensure structure exists
                savedMember.family_lineage_links = {
                    immediate_relations: links.immediate_relations || {},
                    extended_network: {
                        paternal: links.extended_network?.paternal || {},
                        maternal: links.extended_network?.maternal || {},
                        in_laws: links.extended_network?.in_laws || {}
                    }
                };

                await savedMember.save();
                console.log('Saved family_lineage_links for member:', savedMember.memberId);
            } catch (linkErr) {
                console.error('Failed to save family_lineage_links:', linkErr.message);
            }
        }

        // ---------------------------------------------------------
        // AUTO-CREATE USER
        // ---------------------------------------------------------
        // ---------------------------------------------------------
        // AUTO-CREATE USER
        // ---------------------------------------------------------
        try {
            const User = require('../models/User');
            const bcrypt = require('bcryptjs');

            const isAdmin = req.user && (req.user.role === 'Admin' || req.user.role === 'SuperAdmin');

            if (isAdmin) {
                 // ADMIN LOGIC: Create Verified User with Name-based Username
                 // 1. Generate Username (firstname + lastname, lowercase)
                 const fName = (payload.firstName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                 const lName = (payload.lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                 let baseUsername = `${fName}${lName}`;
                 
                 if (!baseUsername) baseUsername = `user${savedMember.memberId}`; // Fallback

                 // Ensure uniqueness
                 let username = baseUsername;
                 let counter = 1;
                 while (await User.findOne({ username })) {
                     username = `${baseUsername}${counter}`;
                     counter++;
                 }

                 // 2. Hash Password (Default: 123456)
                 const hashedPassword = await bcrypt.hash('123456', 10);

                 // 3. Create User
                 const newUser = new User({
                     username: username,
                     password: hashedPassword,
                     email: payload.email || undefined, // Use email if provided (might be sparse unique)
                     mobile: payload.mobile || payload.phone || undefined,
                     role: 'Member',
                     isVerified: true, // Auto-verified by Admin
                     isActive: true,
                     name: savedMember.fullName || `${savedMember.firstName} ${savedMember.lastName}`,
                     memberId: savedMember._id, // Link using ObjectId
                     permissions: ['member.view', 'member.edit'] // Basic permissions
                 });

                 await newUser.save();
                 console.log(`[Auto-Create] Created Admin-Verified User '${username}' for Member '${savedMember.fullName}'`);

            } else {
                // DEFAULT LOGIC: Create Pending User with ID-based Username
                const mobilePassword = payload.mobile || '123456'; 
                const hashedPassword = await bcrypt.hash(mobilePassword, 10);

                const newUser = new User({
                    username: savedMember.memberId, // Login with Member ID
                    password: hashedPassword,
                    name: `${savedMember.firstName} ${savedMember.lastName}`,
                    email: savedMember.email, 
                    mobile: savedMember.mobile,
                    role: 'Member',
                    isVerified: false, // PENDING ADMIN APPROVAL
                    memberId: savedMember.memberId
                });

                await newUser.save();
                console.log(`[Auto-Create] Created Pending User '${savedMember.memberId}' for Member '${savedMember.memberId}'`);
            }
        } catch (err) {
            console.error(`[Auto-Create] Failed to create user for member ${savedMember.memberId}:`, err.message);
        }

        // ---------------------------------------------------------


        // ---------------------------------------------------------
        // AUTO-LINK USER TO MEMBER (If User has no profile)
        // ---------------------------------------------------------
        if (req.user && req.user.id) {
            const User = require('../models/User');
            // Fetch fresh user to check current linkage status
            const currentUser = await User.findById(req.user.id);
            
            if (currentUser && !currentUser.memberId) {
                console.log(`[Auto-Link] Linking User ${currentUser.username} to new Member ${savedMember.memberId}`);
                currentUser.memberId = savedMember._id; // Using ObjectId for robust linking (consistent with link_admin.js)
                await currentUser.save();
            }
        }

        res.status(201).json(savedMember);
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(val => ({
                field: val.path,
                message: val.message
            }));
            return res.status(400).json({ 
                message: 'Validation Failed', 
                errors: errors 
            });
        }
        res.status(500).json({ message: err.message }); // Use 'message' standard
    }
});

/**
 * @swagger
 * /api/members/{id}:
 *   put:
 *     summary: Update member
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Member'
 *     responses:
 *       200:
 *         description: Member updated
 */
router.put('/:id', verifyToken, checkPermission('member.edit'), uploadMiddleware([
    { name: 'photo', maxCount: 1 },
    { name: 'spousePhoto', maxCount: 1 }
]), async (req, res) => {
    try {
        const mainId = req.params.id;
        let updates = req.body;
        updates.id = mainId; // Ensure ID is passed

        // Handle Files
        if (req.files) {
            if (req.files['photo']) {
                updates.photoUrl = `uploads/${req.files['photo'][0].filename}`;
            }
            if (req.files['spousePhoto']) {
                updates.spousePhotoUrl = `uploads/${req.files['spousePhoto'][0].filename}`;
            }
        }
        
        console.log(`[DEBUG] PUT /members/${mainId} Payload:`, JSON.stringify(req.body, null, 2)); // DEBUG LOG

        const member = await Member.findById(mainId);
        if (!member) return res.status(404).json({ message: 'Member not found' });

        // Logic: New Family ID if Marriage Status changes
        if (updates.maritalStatus === 'Married' && member.maritalStatus !== 'Married' && !member.fatherId && !member.motherId) {
            if (!updates.familyId || updates.familyId === 'Unassigned') {
                updates.familyId = await generateFamilyId();
                updates.isPrimary = true;
            }
        }

        // BUNDLE SPOUSE DATA (Flat -> Nested for update)
        if (updates.spouseName) {
            updates.spouse = {
                firstName: updates.spouseName,
                middleName: updates.spouseMiddleName,
                lastName: updates.spouseLastName,
                prefix: updates.spousePrefix, // Map spousePrefix to prefix for the spouse member
                gender: updates.spouseGender,
                dob: updates.spouseDob,
                memberId: updates.spouseMemberId, // If provided
                // Use Existing Spouse ID if available
                _id: updates.spouseId || member.spouseId || undefined
            };
            // If photo updated
            if (updates.spousePhotoUrl) {
                updates.spouse.photoUrl = updates.spousePhotoUrl;
            }
        }

        // Use Recursive Helper
        const updatedMember = await upsertMemberRecursive(updates, {});

        // Invalidate dashboard cache when member is updated
        cacheService.del(cacheService.KEYS.DASHBOARD_STATS);

        res.json(updatedMember);

    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/members/{id}:
 *   delete:
 *     summary: Delete member
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member deleted
 */
router.delete('/:id', verifyToken, checkPermission('member.delete'), async (req, res) => {
    try {
        await Member.findByIdAndDelete(req.params.id);
        
        // Invalidate Dashboard Cache
        cacheService.del(cacheService.KEYS.DASHBOARD_STATS);

        res.json({ message: 'Member deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Birth Family (Initialize new family tree for a member)
// This effectively makes them the Primary Member of a new Family ID.
router.post('/:id/create-family', verifyToken, checkPermission('member.edit'), async (req, res) => {
    try {
        const memberId = req.params.id;
        const member = await Member.findById(memberId);

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // If member already has a Real Family (starting with F and not Unassigned/New), warning?
        // But user said "at any time". So we allow it.
        // It's like "moving out" or "claiming birthright".

        // Generate New Family ID
        const newFamilyId = await generateFamilyId();

        // Updates for Main Member
        member.familyId = newFamilyId;
        member.isPrimary = true; // They become the Head of this new tree
        await member.save();

        // Children Handling:
        // Logic: If I create a family, do my children come with me?
        // If they are my "birth" children, yes.
        // But if I am a mother, my children usually belong to my Husband's family.
        // The user requirement: "Mother's birth family" or "Son-in-Law's birth family".
        // Usually, a Mother's birth family does NOT include her children (they belong to Father's line).
        // A Son-In-Law's birth family DOES include his children (if he is the father).

        // So: Move children ONLY IF I am Male (Patrilineal assumption common in these communities) 
        // OR if the children were previously 'Unassigned' or attached to me specifically.

        // Revised Logic: 
        // If Male: Move children. 
        // If Female: Do NOT move children (they stay with Father, or if Father is unknown/unassigned, maybe move?)
        // Let's stick to: "Only move children if I am the Father".

        if (member.gender === 'Male') {
            const children = await Member.find({ fatherId: member._id });
            for (const child of children) {
                // Only move if they don't have a distinct family yet or are part of the old block
                // Actually, best to just move them to ensure tree continuity.
                child.familyId = newFamilyId;
                await child.save();
            }
        }

        res.json({
            message: 'New Birth Family created successfully',
            familyId: newFamilyId,
            memberId: member._id
        });

    } catch (err) {
        console.error("Create Family Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get Dashboard Stats (Custom) -> Only needs View permission
/**
 * @swagger
 * /api/members/stats/dashboard:
 *   get:
 *     summary: Get dashboard statistics (Counts for members, donations, events)
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalMembers:
 *                   type: integer
 *                 maleCount:
 *                   type: integer
 *                 femaleCount:
 *                   type: integer
 *                 totalDonationAmount:
 *                   type: integer
 */
router.get('/stats/dashboard', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        // Check cache first
        const cached = cacheService.get(cacheService.KEYS.DASHBOARD_STATS);
        if (cached) {
            return res.json(cached);
        }

        // =====================================================
        // OPTIMIZED DASHBOARD AGGREGATION
        // =====================================================
        const Fund = require('../models/Fund');
        const Event = require('../models/Event');
        
        const now = new Date();
        const lastWeek = new Date(new Date().setDate(now.getDate() - 7));
        const today = new Date();

        // Execution
        const [
            // 1. Basic Counts (Alive Only for directory population)
            totalMembers,
            maleCount,
            femaleCount,
            marriedCount,
            singleMaleCount,
            singleFemaleCount,
            primaryMemberCount,
            
            // 2. Weekly Increments (Recent - Alive Only)
            newMembersLastWeek,
            newMalesLastWeek,
            newFemalesLastWeek,
            newMarriedLastWeek,
            
            // 3. Family Stats (Distinct families with at least one alive member)
            distinctFamilies,

            // 4. Complex Aggregations (Alive Only)
            educationByGender,
            ageDistribution,
            maritalStatusStats,
            genderRatioAge,
            
            // 5. Other Widget Data
            recentMembers,
            
            // 6. Existing Stats (Financials/Events unrelated to member life status)
            donationAgg,
            upcomingEvents
        ] = await Promise.all([
            // Basic Counts (ALIVE ONLY)
            Member.countDocuments({ 'personal_info.life_status': { $ne: 'Deceased' } }),
            Member.countDocuments({ gender: 'Male', 'personal_info.life_status': { $ne: 'Deceased' } }),
            Member.countDocuments({ gender: 'Female', 'personal_info.life_status': { $ne: 'Deceased' } }),
            Member.countDocuments({ maritalStatus: 'Married', 'personal_info.life_status': { $ne: 'Deceased' } }),
            Member.countDocuments({ gender: 'Male', maritalStatus: 'Single', 'personal_info.life_status': { $ne: 'Deceased' } }),
            Member.countDocuments({ gender: 'Female', maritalStatus: 'Single', 'personal_info.life_status': { $ne: 'Deceased' } }),
            Member.countDocuments({ isPrimary: true, 'personal_info.life_status': { $ne: 'Deceased' } }),

            // Weekly Stats (ALIVE ONLY)
            Member.countDocuments({ createdAt: { $gte: lastWeek }, 'personal_info.life_status': { $ne: 'Deceased' } }),
            Member.countDocuments({ gender: 'Male', createdAt: { $gte: lastWeek }, 'personal_info.life_status': { $ne: 'Deceased' } }),
            Member.countDocuments({ gender: 'Female', createdAt: { $gte: lastWeek }, 'personal_info.life_status': { $ne: 'Deceased' } }),
            Member.countDocuments({ maritalStatus: 'Married', createdAt: { $gte: lastWeek }, 'personal_info.life_status': { $ne: 'Deceased' } }),

            // Distinct Families
            Member.aggregate([
                { $match: { 'personal_info.life_status': { $ne: 'Deceased' } } },
                { $group: { _id: "$familyId" } },
                { $count: "count" }
            ]).catch(() => []),

            // Education by Gender (ALIVE ONLY)
            Member.aggregate([
                { $match: { education: { $exists: true, $ne: "" }, 'personal_info.life_status': { $ne: 'Deceased' } } },
                {
                    $addFields: {
                        eduCategory: {
                            $switch: {
                                branches: [
                                   { case: { $regexMatch: { input: "$education", regex: /doctor|mbbs|phd|md|bams|bhms/i } }, then: "Doctor" },
                                   { case: { $regexMatch: { input: "$education", regex: /engineer|b\.?\s*e|b\.?\s*tech|m\.?\s*tech|diploma/i } }, then: "Engineer" },
                                   { case: { $regexMatch: { input: "$education", regex: /post.*graduate|master|m\.?\s*a|m\.?\s*sc|m\.?\s*com|mba|mca|pg/i } }, then: "Post Graduate" },
                                   { case: { $regexMatch: { input: "$education", regex: /graduate|bachelor|b\.?\s*a|b\.?\s*sc|b\.?\s*com|bca|bba/i } }, then: "Graduate" },
                                   { case: { $regexMatch: { input: "$education", regex: /12th|hsc|inter/i } }, then: "12th" },
                                   { case: { $regexMatch: { input: "$education", regex: /10th|ssc|matric/i } }, then: "10th" },
                                   { case: { $regexMatch: { input: "$education", regex: /[5-9]th|primary/i } }, then: "Primary (5th-9th)" }
                                ],
                                default: "Other"
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: "$eduCategory",
                        male: { $sum: { $cond: [{ $eq: ["$gender", "Male"] }, 1, 0] } },
                        female: { $sum: { $cond: [{ $eq: ["$gender", "Female"] }, 1, 0] } },
                        count: { $sum: 1 }
                    }
                }
            ]).catch(() => []),

            // Revised Age Distribution (ALIVE ONLY)
            Member.aggregate([
                { $match: { dob: { $exists: true, $ne: null }, 'personal_info.life_status': { $ne: 'Deceased' } } },
                {
                    $project: {
                        age: {
                            $floor: { $divide: [{ $subtract: [new Date(), "$dob"] }, 31536000000] }
                        }
                    }
                },
                {
                    $bucket: {
                        groupBy: "$age",
                        boundaries: [0, 11, 26, 36, 51], 
                        default: "51+",
                        output: { count: { $sum: 1 } }
                    }
                }
            ]).catch(() => []),

            // Marital Stats (ALIVE ONLY)
            Member.aggregate([
                { $match: { 'personal_info.life_status': { $ne: 'Deceased' } } },
                { $group: { _id: "$maritalStatus", count: { $sum: 1 } } }
            ]).catch(() => []),
            
            // Gender Ratio (Dummy/Empty placeholder as before)
            Promise.resolve([]), 

            // Recent Members (Alive Only)
            Member.find({ 'personal_info.life_status': { $ne: 'Deceased' } })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('firstName lastName memberId gender city maritalStatus dob photoUrl education phone')
                .lean(),

            // Financials
            Fund.aggregate([{ $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } }]).catch(() => []),
            Event.countDocuments({ date: { $gte: today } }).catch(() => 0)
        ]);

        // Process Data
        const stats = {
            counts: {
                total: totalMembers,
                primary: primaryMemberCount,
                male: maleCount,
                female: femaleCount,
                male: maleCount,
                female: femaleCount,
                married: marriedCount,
                singleMale: singleMaleCount,
                singleFemale: singleFemaleCount,
                families: distinctFamilies[0]?.count || 0,
                donationAmount: donationAgg[0]?.totalAmount || 0,
                weekly: {
                    total: newMembersLastWeek,
                    male: newMalesLastWeek,
                    female: newMalesLastWeek, // Approximation/Error fix: should be females
                    married: newMarriedLastWeek
                }
            },
            charts: {
                education: educationByGender.sort((a,b) => b.count - a.count),
                age: ageDistribution.sort((a,b) => (typeof a._id === 'number' ? a._id : 999) - (typeof b._id === 'number' ? b._id : 999)),
                marital: maritalStatusStats
            },
            widgets: {
                recentMembers: recentMembers || [],
                donations: donationAgg[0] || { totalAmount: 0, count: 0 },
                eventCount: upcomingEvents,
                invitations: [ // Mock Invitations
                    { id: 1, name: "Mahesh Patel", role: "Admin", status: "Sent", time: "2 mins ago" },
                    { id: 2, name: "Suresh Suthar", role: "Member", status: "Pending", time: "1 hour ago" },
                    { id: 3, name: "Anita Sharma", role: "Member", status: "Accepted", time: "5 hours ago" }
                ]
            }
        };
        
        // Fix typo in weekly females above (used male var)
        stats.counts.weekly.female = newFemalesLastWeek;

        // Cache the result for 5 minutes
        cacheService.set(cacheService.KEYS.DASHBOARD_STATS, stats, 300);

        res.json(stats);
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/members/:id/matrimony-status
 * Update showOnMatrimony flag
 */
router.patch('/:id/matrimony-status', verifyToken, checkPermission('member.update'), async (req, res) => {
    try {
        const { showOnMatrimony } = req.body;
        
        const member = await Member.findByIdAndUpdate(
            req.params.id, 
            { 
                'personal_info.showOnMatrimony': showOnMatrimony,
                showOnMatrimony: showOnMatrimony // Sync root field
            }, 
            { new: true }
        );

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        res.json({ message: 'Matrimony status updated', member });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

/**
 * GET /api/members/eligible-relations
 * Returns members eligible for various relationship types
 */
router.get('/eligible-relations', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        const { type, gender, excludeId } = req.query;
        let query = {};

        switch (type) {
            case 'father':
            case 'dada':
            case 'nana':
                query.gender = 'Male';
                break;
            case 'mother':
            case 'dadi':
            case 'nani':
                query.gender = 'Female';
                break;
            case 'spouse':
                query.gender = gender === 'Male' ? 'Female' : 'Male';
                break;
            case 'kaka':
            case 'mama':
            case 'fufa':
            case 'mausa':
            case 'jija':
            case 'saala':
                query.gender = 'Male';
                break;
            case 'kaki':
            case 'bua':
            case 'mami':
            case 'mausi':
            case 'saali':
                query.gender = 'Female';
                break;
        }

        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const members = await Member.find(query)
            .select('_id memberId firstName middleName lastName gender dob maritalStatus city village')
            .sort({ firstName: 1 })
            .limit(200)
            .lean();

        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


/**
 * GET /api/members/by-pincode/:pincode
 * Geography-based search - Find members by pincode
 */
router.get('/by-pincode/:pincode', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        const { pincode } = req.params;
        const { gender, marital_status, limit = 50 } = req.query;

        let query = {
            $or: [
                { 'geography.pincode': new RegExp(pincode, 'i') },
                { 'communication_info.address.pincode': new RegExp(pincode, 'i') },
                { 'address': new RegExp(pincode, 'i') } // Fallback for legacy data
            ]
        };

        // Add gender filter if provided
        if (gender) {
            query.$and = [
                {
                    $or: [
                        { 'personal_info.gender': gender },
                        { 'gender': gender } // Legacy field
                    ]
                }
            ];
        }

        // Add marital status filter if provided
        if (marital_status) {
            query.maritalStatus = marital_status;
        }

        const members = await Member.find(query)
            .select('memberId personal_info geography firstName middleName lastName gender dob maritalStatus city village')
            .limit(parseInt(limit))
            .sort({ 'personal_info.names.first_name': 1, firstName: 1 })
            .lean();

        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/members/:id/siblings
 * Auto-detect siblings based on parental_union_id
 */
router.get('/:id/siblings', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        const memberId = req.params.id;
        const member = await Member.findById(memberId);

        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        const parentalUnionId = member.lineage_links?.parental_union_id;

        if (!parentalUnionId) {
            return res.json({ siblings: [], message: 'No parental union found' });
        }

        // Find all members with same parental_union_id (excluding self)
        const siblings = await Member.find({
            'lineage_links.parental_union_id': parentalUnionId,
            _id: { $ne: memberId }
        })
            .select('memberId personal_info firstName lastName gender dob')
            .lean();

        res.json({ siblings, parental_union_id: parentalUnionId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/members/search/maiden-name/:name
 * Search by maiden name (for married women)
 */
router.get('/search/maiden-name/:name', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        const { name } = req.params;
        const { limit = 20 } = req.query;

        const members = await Member.find({
            'personal_info.names.maiden_name': new RegExp(name, 'i')
        })
            .select('memberId personal_info geography firstName lastName')
            .limit(parseInt(limit))
            .lean();

        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

