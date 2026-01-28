const express = require('express');
const router = express.Router();
const cacheService = require('../services/cache.service');

/**
 * @swagger
 * tags:
 *   name: Funds
 *   description: Fund and Donation Management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Fund:
 *       type: object
 *       required:
 *         - amount
 *         - type
 *       properties:
 *         amount:
 *           type: number
 *         type:
 *           type: string
 *           enum: [Donation, Expense]
 *         description:
 *           type: string
 */
const Fund = require('../models/Fund');
const Member = require('../models/Member'); // We need this to populate name
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/funds:
 *   get:
 *     summary: Get all funds
 *     tags: [Funds]
 *     responses:
 *       200:
 *         description: List of funds
 */
router.get('/', async (req, res) => {
    try {
        const funds = await Fund.find().sort({ date: -1 });

        // Populate Member Details Manually or via Populate if Ref existed
        // Since Member schema might be complex with the Proxy/JSON, let's fast fetch all members or do one-by-one
        // Ideally we would use .populate('memberId') if it was a true Ref.
        // Let's try to map them.

        // For now, let's return the funds. The frontend does the mapping with the Member List it already fetches?
        // Actually, the Frontend `FundListComponent` currently does a `combineLatest` with `getMembers()`.
        // So sending raw data is fine, frontend handles the join.
        res.json(funds);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/funds:
 *   post:
 *     summary: Create a new fund entry
 *     tags: [Funds]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Fund'
 *     responses:
 *       201:
 *         description: Fund entry created
 */
router.post('/', verifyToken, checkPermission('funds.manage'), async (req, res) => {
    try {
        const { memberId, amount, type, date, description } = req.body;

        const newFund = new Fund({
            memberId,
            amount,
            type,
            date,
            description,
            createdBy: req.user.id
        });

        await newFund.save();
        // Invalidate dashboard cache when fund is created
        cacheService.invalidateDashboard();
        res.status(201).json(newFund);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
