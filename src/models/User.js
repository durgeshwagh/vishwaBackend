const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Hashed
    email: { type: String, unique: true, sparse: true },
    mobile: { type: String },
    role: { type: String, enum: ['SuperAdmin', 'Admin', 'Member'], default: 'Member' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }, // Added for enable/disable functionality
    permissions: { type: [String], default: [] }, // e.g. ['create', 'read', 'update', 'delete']
    otp: { type: String, select: false }, // Don't return by default
    otpExpires: { type: Date, select: false },
    name: { type: String },
    memberId: { type: String }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual field for display name with fallback logic
UserSchema.virtual('displayName').get(function () {
    return this.name || this.username;
});

// Indexes for optimized queries
UserSchema.index({ email: 1 }, { unique: true, sparse: true }); // Login by email
UserSchema.index({ mobile: 1 }, { sparse: true }); // Login/search by mobile
UserSchema.index({ username: 1 }, { unique: true }); // Login by username
UserSchema.index({ role: 1, isVerified: 1 }); // Admin queries for user management
UserSchema.index({ isVerified: 1 }); // Pending approvals query

module.exports = mongoose.model('User', UserSchema);
