const mongoose = require('mongoose');

const NoticeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    fileUrl: { type: String }, // Optional attachment (Patrika/Image)
    type: {
        type: String,
        enum: ['General', 'Event', 'Urgent'],
        default: 'General'
    },
    target: {
        type: String,
        enum: ['All', 'Selected'],
        default: 'All'
    },
    recipients: [{ type: String }], // Array of Member IDs if target is 'Selected'
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Track who has read this notice
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

// Indexes for optimized queries
NoticeSchema.index({ createdAt: -1 }); // Recent notices first
NoticeSchema.index({ type: 1, createdAt: -1 }); // Filter by type + sort
NoticeSchema.index({ readBy: 1 }); // Unread notices query
NoticeSchema.index({ target: 1, createdAt: -1 }); // Target filter + sort
NoticeSchema.index({ createdAt: -1, _id: 1 }); // Pagination optimization

module.exports = mongoose.model('Notice', NoticeSchema);
