const mongoose = require('mongoose');

const UnionSchema = new mongoose.Schema({
    union_id: {
        type: String,
        unique: true,
        required: true,
        description: 'Unique identifier for this union (e.g., UNION_0001)'
    },

    // Core Union Members
    husband_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true,
        description: 'Reference to male spouse'
    },
    wife_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true,
        description: 'Reference to female spouse'
    },

    // Marriage Details
    marriage_date: { type: Date },
    marriage_place: { type: String },
    union_type: {
        type: String,
        enum: ['birth_family', 'marriage'],
        default: 'marriage',
        description: 'Type of union - birth_family for parents, marriage for couples'
    },

    // Children linked to this union
    children_ids: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        description: 'Array of children born to this union'
    }],

    // Union Status
    status: {
        type: String,
        enum: ['Active', 'Divorced', 'Deceased', 'Separated'],
        default: 'Active'
    },

    // Verification System
    verification: {
        is_verified: { type: Boolean, default: false },
        verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        verified_at: { type: Date },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending'
        },
        rejection_reason: { type: String }
    },

    // Metadata
    meta_data: {
        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual to get both spouses
UnionSchema.virtual('spouses').get(function () {
    return {
        husband: this.husband_id,
        wife: this.wife_id
    };
});

// Indexes for performance
UnionSchema.index({ union_id: 1 });
UnionSchema.index({ husband_id: 1 });
UnionSchema.index({ wife_id: 1 });
UnionSchema.index({ 'verification.status': 1 });
UnionSchema.index({ union_type: 1 });

// Pre-save middleware to update timestamp
UnionSchema.pre('save', function (next) {
    this.meta_data.updated_at = Date.now();
    next();
});

module.exports = mongoose.model('Union', UnionSchema);
