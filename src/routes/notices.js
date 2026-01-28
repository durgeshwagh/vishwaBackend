const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');
const multer = require('multer');

// Configure Multer for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `notice-${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

/**
 * @swagger
 * tags:
 *   name: Notices
 *   description: Notice Board and Notifications
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Notice:
 *       type: object
 *       required:
 *         - title
 *         - message
 *       properties:
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         type:
 *           type: string
 *           enum: [General, Meeting, Event]
 *         target:
 *           type: string
 *           enum: [All, Selected]
 */

/**
 * @swagger
 * /api/notices:
 *   post:
 *     summary: Create a notice (Admin only)
 *     tags: [Notices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Notice'
 *     responses:
 *       201:
 *         description: Notice created
 */
router.post('/', verifyToken, checkPermission('notices.manage'), upload.single('file'), async (req, res) => {
    try {
        const { title, message, type, target, recipients } = req.body;
        let fileUrl = '';

        if (req.file) {
            fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        let parsedRecipients = [];
        if (recipients) {
            try {
                parsedRecipients = typeof recipients === 'string' ? JSON.parse(recipients) : recipients;
            } catch (e) {
                console.error('Error parsing recipients:', e);
            }
        }

        const newNotice = new Notice({
            title,
            message,
            type,
            target,
            fileUrl,
            recipients: parsedRecipients,
            createdBy: req.user.id
        });

        console.log('Creating Notice:', { title, target, recipients: parsedRecipients });

        await newNotice.save();
        res.status(201).json(newNotice);
    } catch (err) {
        console.error('Error creating notice:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/notices/sent:
 *   get:
 *     summary: Get sent notices (Admin only)
 *     tags: [Notices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sent notices
 */
router.get('/sent', verifyToken, checkPermission('notices.manage'), async (req, res) => {
    try {
        const notices = await Notice.find().sort({ createdAt: -1 });
        res.json(notices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/notices/my-notices:
 *   get:
 *     summary: Get notices for logged in user
 *     tags: [Notices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notices
 */
router.get('/my-notices', verifyToken, async (req, res) => {
    try {
        const memberId = req.user.memberId;

        // Find notices that are either for 'All' or explicitly include this memberId
        const notices = await Notice.find({
            $or: [
                { target: 'All' },
                { recipients: memberId } // If memberId is in the array
            ]
        }).sort({ createdAt: -1 });

        res.json(notices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Send Patrika (Any logged in user can send to another member)
router.post('/patrika', verifyToken, upload.single('file'), async (req, res) => {
    try {
        const { recipientId, title } = req.body; // recipientId is memberId
        if (!recipientId || !req.file) {
            return res.status(400).json({ message: 'Recipient and File are required' });
        }

        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        const newNotice = new Notice({
            title: title || 'New Patrika Received',
            message: `You have received a new Patrika from ${req.user.name || 'a member'}`,
            type: 'General', // Using General type for now, or could define 'Patrika'
            target: 'Selected',
            fileUrl,
            recipients: [recipientId],
            createdBy: req.user.id
        });

        await newNotice.save();
        res.status(201).json(newNotice);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/notices/notifications:
 *   get:
 *     summary: Get unread notifications
 *     tags: [Notices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification list and count
 */
router.get('/notifications', verifyToken, async (req, res) => {
    try {
        const memberId = req.user.memberId;
        // console.log('Fetching notifications for MemberID:', memberId); // Debug

        if (!memberId) return res.json({ count: 0, notifications: [] });

        const notices = await Notice.find({
            recipients: memberId,
            readBy: { $ne: req.user.id }
        }).sort({ createdAt: -1 });

        // console.log(`Found ${notices.length} notifications`); // Debug

        res.json({
            count: notices.length,
            notifications: notices
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark Notification as Read
router.put('/:id/read', verifyToken, async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);
        if (!notice) return res.status(404).json({ message: 'Notice not found' });

        if (!notice.readBy.includes(req.user.id)) {
            notice.readBy.push(req.user.id);
            await notice.save();
        }
        res.json(notice);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
module.exports = router;
