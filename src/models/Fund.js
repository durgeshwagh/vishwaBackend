const mongoose = require('mongoose');

const FundSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true
    }, // Changed to ObjectId for better referential integrity
    amount: { type: Number, required: true },
    type: {
        type: String,
        enum: ['General', 'Temple', 'Education', 'Event'],
        required: true
    },
    date: { type: Date, default: Date.now },
    description: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Audit trail
}, {
    timestamps: true
});

// Indexes for optimized queries
FundSchema.index({ date: -1 }); // Sort by date (most recent first)
FundSchema.index({ type: 1, date: -1 }); // Filter by type + sort by date
FundSchema.index({ memberId: 1 }); // Member's funds lookup
FundSchema.index({ createdBy: 1 }); // Audit queries
FundSchema.index({ createdAt: -1, _id: 1 }); // Pagination optimization

module.exports = mongoose.model('Fund', FundSchema);
