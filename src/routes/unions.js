const express = require('express');
const Union = require('../models/Union');
const Member = require('../models/Member');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');
const router = express.Router();

/**
 * Helper function to generate unique union ID
 */
async function generateUnionId() {
    const count = await Union.countDocuments();
    return `UNION_${(count + 1).toString().padStart(4, '0')}`;
}

/**
 * POST /api/unions
 * Create a new union (marriage/partnership)
 */
router.post('/', verifyToken, checkPermission('member.create'), async (req, res) => {
    try {
        const { husband_id, wife_id, marriage_date, marriage_place, children_ids } = req.body;

        // Validate husband and wife exist
        const husband = await Member.findById(husband_id);
        const wife = await Member.findById(wife_id);

        if (!husband || !wife) {
            return res.status(404).json({ error: 'Husband or Wife not found' });
        }

        // Validate genders
        const husbandGender = husband.personal_info?.gender || husband.gender;
        const wifeGender = wife.personal_info?.gender || wife.gender;

        if (husbandGender !== 'Male' || wifeGender !== 'Female') {
            return res.status(400).json({ error: 'Invalid gender combination for union' });
        }

        // Generate union ID
        const union_id = await generateUnionId();

        // Create union
        const newUnion = new Union({
            union_id,
            husband_id,
            wife_id,
            marriage_date,
            marriage_place,
            children_ids: children_ids || [],
            union_type: 'marriage',
            verification: {
                status: 'Pending'
            },
            meta_data: {
                created_by: req.user.id
            }
        });

        const savedUnion = await newUnion.save();

        // Update members with current_union_id
        await Member.findByIdAndUpdate(husband_id, {
            $set: { 'lineage_links.current_union_id': savedUnion._id }
        });
        await Member.findByIdAndUpdate(wife_id, {
            $set: { 'lineage_links.current_union_id': savedUnion._id }
        });

        res.status(201).json(savedUnion);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/unions/:id
 * Get union details with populated members
 */
router.get('/:id', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        const union = await Union.findById(req.params.id)
            .populate('husband_id')
            .populate('wife_id')
            .populate('children_ids')
            .populate('verification.verified_by', 'name');

        if (!union) {
            return res.status(404).json({ error: 'Union not found' });
        }

        res.json(union);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/unions/:id/add-child
 * Add a child to an existing union
 */
router.post('/:id/add-child', verifyToken, checkPermission('member.edit'), async (req, res) => {
    try {
        const { child_id } = req.body;
        const unionId = req.params.id;

        const union = await Union.findById(unionId);
        if (!union) {
            return res.status(404).json({ error: 'Union not found' });
        }

        const child = await Member.findById(child_id);
        if (!child) {
            return res.status(404).json({ error: 'Child not found' });
        }

        // Add child to union
        if (!union.children_ids.includes(child_id)) {
            union.children_ids.push(child_id);
            await union.save();
        }

        // Update child's parental_union_id
        await Member.findByIdAndUpdate(child_id, {
            $set: { 'lineage_links.parental_union_id': unionId }
        });

        res.json({ message: 'Child added to union successfully', union });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/unions/pending
 * Get all pending union verifications (for admin)
 */
router.get('/pending', verifyToken, checkPermission('admin.view'), async (req, res) => {
    try {
        const pendingUnions = await Union.find({ 'verification.status': 'Pending' })
            .populate('husband_id')
            .populate('wife_id')
            .populate('children_ids')
            .sort({ 'meta_data.created_at': -1 });

        res.json(pendingUnions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/unions/:id/verify
 * Approve or reject a union (admin only)
 */
router.put('/:id/verify', verifyToken, checkPermission('admin.edit'), async (req, res) => {
    try {
        const { action, rejection_reason } = req.body; // action: 'approve' or 'reject'
        const unionId = req.params.id;

        const union = await Union.findById(unionId);
        if (!union) {
            return res.status(404).json({ error: 'Union not found' });
        }

        if (action === 'approve') {
            union.verification.status = 'Approved';
            union.verification.is_verified = true;
        } else if (action === 'reject') {
            union.verification.status = 'Rejected';
            union.verification.rejection_reason = rejection_reason;
        } else {
            return res.status(400).json({ error: 'Invalid action. Use approve or reject' });
        }

        union.verification.verified_by = req.user.id;
        union.verification.verified_at = new Date();

        await union.save();

        res.json({ message: `Union ${action}d successfully`, union });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/unions/by-member/:memberId
 * Get all unions related to a member (as husband, wife, or child)
 */
router.get('/by-member/:memberId', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        const memberId = req.params.memberId;

        const unions = await Union.find({
            $or: [
                { husband_id: memberId },
                { wife_id: memberId },
                { children_ids: memberId }
            ]
        })
            .populate('husband_id')
            .populate('wife_id')
            .populate('children_ids');

        res.json(unions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/unions/:id
 * Delete a union (soft delete by setting status)
 */
router.delete('/:id', verifyToken, checkPermission('admin.delete'), async (req, res) => {
    try {
        const union = await Union.findById(req.params.id);
        if (!union) {
            return res.status(404).json({ error: 'Union not found' });
        }

        union.status = 'Deceased'; // Soft delete
        await union.save();

        res.json({ message: 'Union deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
