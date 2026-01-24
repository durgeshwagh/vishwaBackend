const express = require('express');
const Event = require('../models/Event');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Multer Configuration for Events
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/events/';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'event-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB (for videos)
});

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Event Management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Event:
 *       type: object
 *       required:
 *         - title
 *         - date
 *       properties:
 *         title:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *         description:
 *           type: string
 *         location:
 *           type: string
 */

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get all events
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: List of events
 */
router.get('/', async (req, res) => {
    try {
        const events = await Event.find().sort({ date: 1 });
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Event'
 *     responses:
 *       201:
 *         description: Event created
 */
router.post('/', verifyToken, upload.single('media'), async (req, res) => {
    try {
        const payload = { ...req.body };
        
        if (req.file) {
            const mediaPath = `uploads/events/${req.file.filename}`;
            if (req.body.mediaType === 'Video') {
                payload.videoUrl = mediaPath;
            } else {
                payload.imageUrl = mediaPath;
            }
        }

        const newEvent = new Event(payload);
        const savedEvent = await newEvent.save();
        res.status(201).json(savedEvent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event details
 */
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/events/{id}:
 *   put:
 *     summary: Update event
 *     tags: [Events]
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
 *             $ref: '#/components/schemas/Event'
 *     responses:
 *       200:
 *         description: Event updated
 */
router.put('/:id', verifyToken, upload.single('media'), async (req, res) => {
    try {
        const updates = { ...req.body };
        
        if (req.file) {
            const mediaPath = `uploads/events/${req.file.filename}`;
            if (req.body.mediaType === 'Video') {
                updates.videoUrl = mediaPath;
                updates.imageUrl = ''; // Clear other one
            } else {
                updates.imageUrl = mediaPath;
                updates.videoUrl = ''; // Clear other one
            }
        }

        const updatedEvent = await Event.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!updatedEvent) return res.status(404).json({ message: 'Event not found' });
        res.json(updatedEvent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Delete event
 *     tags: [Events]
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
 *         description: Event deleted
 */
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        await Event.findByIdAndDelete(req.params.id);
        res.json({ message: 'Event deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
