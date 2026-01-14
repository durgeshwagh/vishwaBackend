const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
    memberId: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    middleName: { type: String }, // New Field
    lastName: { type: String, required: true },
    gender: { type: String, required: true }, // 'Male' | 'Female'
    dob: { type: Date, required: true },
    maritalStatus: { type: String, required: true }, // 'Single' | 'Married' | 'Divorced' | 'Widowed'
    occupation: { type: String },

    // Contact & Location
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    state: { type: String },
    district: { type: String }, // New Field
    city: { type: String },
    village: { type: String }, // New Field

    photoUrl: { type: String },
    spousePhotoUrl: { type: String }, // New Field
    spouseLastName: { type: String }, // New Field

    // Relationships
    familyId: { type: String, default: 'FNew' },
    fatherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    motherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    spouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    isPrimary: { type: Boolean, default: false }, // Head of Family

    // Additional fields requested by user in previous turns likely need to be here if they were lost, 
    // but sticking to what was in the file minus proxy logic is the safest route for "removing mock db".
    // I will preserve the exact schema structure from the file I read.
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for full name
MemberSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Indexes for optimized searching and filtering
// Compound Text Index for fast full-text search across multiple fields
MemberSchema.index({ 
    firstName: 'text', 
    lastName: 'text',
    middleName: 'text',
    occupation: 'text', 
    city: 'text', 
    village: 'text',
    memberId: 'text',
    phone: 'text'
});

// Optimized Sort Index
MemberSchema.index({ createdAt: -1 });
MemberSchema.index({ isPrimary: 1 });

module.exports = mongoose.model('Member', MemberSchema);
