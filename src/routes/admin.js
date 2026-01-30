const express = require('express');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin Management
 */
const User = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');
const PERMISSIONS = require('../config/permissions');

// Middleware to check if user is Admin or SuperAdmin
const verifyAdmin = async (req, res, next) => {
    try {
        if (!req.user || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access Denied: Admins Only' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { memberId: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password -otp -otpExpires') // Exclude sensitive fields
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await User.countDocuments(query);

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalUsers: total
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/admin/users/{id}/approve:
 *   put:
 *     summary: Toggle user approval status
 *     tags: [Admin]
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
 *         description: User status updated
 */
router.put('/users/:id/approve', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.isVerified = !user.isVerified; // Toggle status
        await user.save();

        res.json({ message: `User ${user.isVerified ? 'Approved' : 'Unapproved'} successfully`, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Role
router.put('/users/:id/role', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['Admin', 'SuperAdmin', 'Member'].includes(role)) {
            return res.status(400).json({ message: 'Invalid Role' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Prevent modifying own role to avoid accidental lockout (optional check)
        if (user._id.toString() === req.user.id && role !== 'SuperAdmin') {
            // Allow SuperAdmin to demote themselves? Maybe not safe.
            // For now, let's allow it but warn.
        }

        user.role = role;
        await user.save();

        res.json({ message: 'Role updated successfully', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Permissions
router.put('/users/:id/permissions', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { permissions, role, memberId } = req.body;

        const updateData = {};
        if (permissions) updateData.permissions = permissions;
        if (role) updateData.role = role;
        // Allow linking (string) or unlinking (null)
        if (memberId !== undefined) updateData.memberId = memberId;

        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({ message: 'Permissions and details updated', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Available Permissions Config
router.get('/config/permissions', verifyToken, verifyAdmin, (req, res) => {
    res.json(PERMISSIONS);
});

module.exports = router;
