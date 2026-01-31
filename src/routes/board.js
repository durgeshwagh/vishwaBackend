const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

/**
 * @swagger
 * tags:
 *   name: Board
 *   description: Committee/Board Members
 */
const BoardMember = require('../models/BoardMember');
const { verifyToken } = require('../middleware/authMiddleware');
const multer = require('multer');

// Ensure uploads directory exists (Absolute Path for Robustness)
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    console.log(`[System] Creating missing uploads directory at: ${uploadDir}`);
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for File Uploads (Photos)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `board-${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

/**
 * @swagger
 * /api/board:
 *   get:
 *     summary: Get board members
 *     tags: [Board]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of board members
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Build Query
        const query = {};
        if (req.query.year) {
            query.year = { $regex: req.query.year, $options: 'i' };
        }
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { name: searchRegex },
                { role: searchRegex },
                { city: searchRegex }
            ];
        }

        const total = await BoardMember.countDocuments(query);
        const members = await BoardMember.find(query)
            .sort({ year: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            data: members,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalMembers: total
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Single Board Member
router.get('/:id', async (req, res) => {
    try {
        const member = await BoardMember.findById(req.params.id);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        res.json(member);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/board:
 *   post:
 *     summary: Add board member
 *     tags: [Board]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - role
 *               - year
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *               year:
 *                 type: string
 *     responses:
 *       201:
 *         description: Board member added
 */
router.post('/', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        if (!['Admin', 'SuperAdmin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access Denied' });
        }

        const { year, role, name, description, memberId, contact, city } = req.body;
        let photoUrl = '';

        if (req.file) {
            photoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const newMember = new BoardMember({
            year,
            role,
            name,
            description,
            memberId,
            contact,
            city,
            photoUrl,
            createdBy: req.user.id
        });

        await newMember.save();
        res.status(201).json(newMember);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Board Member
router.put('/:id', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        if (!['Admin', 'SuperAdmin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access Denied' });
        }

        const { id } = req.params;
        const updates = req.body;

        if (req.file) {
            updates.photoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const updatedMember = await BoardMember.findByIdAndUpdate(id, updates, { new: true });
        res.json(updatedMember);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Board Member
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        if (!['Admin', 'SuperAdmin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access Denied' });
        }
        await BoardMember.findByIdAndDelete(req.params.id);
        res.json({ message: 'Record deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
