const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
    memberId: { type: String, required: true, unique: true },

    // Personal Information (Enhanced Structure)
    personal_info: {
        names: {
            first_name: { type: String, required: true },
            middle_name: { type: String },
            last_name: { type: String, required: true },
            prefix: { type: String }, // श्री, सौ, श्रीमती, स्व.
            maiden_name: { type: String }, // विवाहापूर्वीचे surname (important for search)
            nickname: { type: String }
        },
        dob: { type: Date, required: true },
        gender: { type: String, enum: ['Male', 'Female'], required: true },
        life_status: { type: String, enum: ['Alive', 'Deceased'], default: 'Alive' },
        showOnMatrimony: { type: Boolean, default: true },
        blood_group: { type: String },
        biodata: {
            education: { type: String },
            height: { type: String },
            occupation: { type: String },
            hobbies: [{ type: String }],
            contact: {
                mobile: { type: String },
                email: { type: String },
                whatsapp: { type: String }
            }
        }
    },

    // Geography (Pincode-based Search)
    geography: {
        pincode: { type: Number },
        state: { type: String },
        district: { type: String },
        taluka: { type: String },
        village: { type: String },
        full_address: { type: String }
    },

    // Union-based Lineage Links (NEW!)
    lineage_links: {
        parental_union_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Union',
            description: 'माहेर - Parents union ID'
        },
        current_union_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Union',
            description: 'सासर - Own marriage union (for married people)'
        },
        // Auto-calculated from unions
        siblings_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
        children_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }]
    },

    // Verification System
    verification_details: {
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending'
        },
        verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        verified_at: { type: Date },
        is_genuine: { type: Boolean, default: true },
        rejection_reason: { type: String }
    },

    // Legacy fields (backward compatibility)
    firstName: { type: String },
    middleName: { type: String },
    lastName: { type: String },
    gender: { type: String },
    dob: { type: Date },
    maritalStatus: { type: String },
    occupation: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    state: { type: String },
    district: { type: String },
    city: { type: String },
    village: { type: String },
    photoUrl: { type: String },
    spousePhotoUrl: { type: String },
    spouseLastName: { type: String },
    spouseMiddleName: { type: String },
    spouseName: { type: String },
    spousePrefix: { type: String }, // Prefix for spouse
    spouseFullName: { type: String }, // Pre-calculated Spouse Full Name
    fullName: { type: String }, // Pre-calculated First + Middle + Last
    stateName: { type: String }, // Pre-resolved state name
    districtName: { type: String }, // Pre-resolved district name
    talukaName: { type: String }, // Pre-resolved taluka name
    villageName: { type: String }, // Pre-resolved village name
    education: { type: String },
    occupationType: { type: String }, // Job, Business, etc.
    spouseEducation: { type: String },
    spouseOccupation: { type: String },
    spouseOccupationType: { type: String },
    height: { type: String },
    prefix: { type: String }, // Pre-calculated or separate prefix
    lifeStatus: { type: String, enum: ['Alive', 'Deceased'], default: 'Alive' },

    // Relationships (Legacy - Maintained for Backward Compatibility)
    familyId: { type: String, default: 'FNew' },
    fatherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    motherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    spouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    isPrimary: { type: Boolean, default: false }, // Head of Family

    // Enhanced Family Lineage Links (New Structure)
    family_lineage_links: {
        // Immediate Relations
        immediate_relations: {
            father_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
            mother_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
            spouse_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
            siblings_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
            children_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }]
        },

        // Extended Network
        extended_network: {
            // Paternal Relations (Pita Paksha)
            paternal: {
                dada_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null }, // Paternal Grandfather
                dadi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null }, // Paternal Grandmother
                kaka_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }], // Paternal Uncles (Father's brothers)
                kaki_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }], // Paternal Aunts (Kaka's wives)
                bua_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }], // Paternal Aunts (Father's sisters)
                fufa_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }] // Bua's husbands
            },

            // Maternal Relations (Matru Paksha)
            maternal: {
                nana_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null }, // Maternal Grandfather
                nani_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null }, // Maternal Grandmother
                mama_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }], // Maternal Uncles (Mother's brothers)
                mami_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }], // Mama's wives
                mausi_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }], // Maternal Aunts (Mother's sisters)
                mausa_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }] // Mausi's husbands
            },

            // In-Laws (Sasural)
            in_laws: {
                father_in_law_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null }, // Sasur
                mother_in_law_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null }, // Saas
                jija_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }], // Sister's husband
                saala_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }], // Wife's brother
                saali_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }] // Wife's sister
            }
        }
    },

    // Metadata
    meta_data: {
        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Note: fullName is stored as a pre-calculated field (line 92), not a virtual
// Virtual for age calculation
MemberSchema.virtual('age').get(function () {
    if (!this.dob) return null;
    return Math.floor((Date.now() - this.dob) / (365.25 * 24 * 60 * 60 * 1000));
});

// Virtual for showOnMatrimony (Alias to personal_info.showOnMatrimony)
MemberSchema.virtual('showOnMatrimony')
    .get(function () {
        return this.personal_info && this.personal_info.showOnMatrimony;
    })
    .set(function (v) {
        if (!this.personal_info) this.personal_info = {};
        this.personal_info.showOnMatrimony = v;
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
    phone: 'text',
    spouseMiddleName: 'text',
    fullName: 'text' 
});

// Optimized Sort Indexes
MemberSchema.index({ isPrimary: 1, createdAt: -1 }); // Primary List
MemberSchema.index({ createdAt: -1 });
MemberSchema.index({ isPrimary: 1 });

// Performance Optimization Indexes (for member list page)
MemberSchema.index({ firstName: 1, lastName: 1 }); // Name search and sorting
MemberSchema.index({ fullName: 1 }); // Added index for $or search compatibility
MemberSchema.index({ city: 1 }); // Location filtering
MemberSchema.index({ phone: 1 }); // Phone search
MemberSchema.index({ familyId: 1, isPrimary: 1 }); // Family queries with primary status
MemberSchema.index({ familyId: 1, createdAt: 1 }); // Family timeline/tree queries

// Relationship Indexes for fast lookups
MemberSchema.index({ 'family_lineage_links.immediate_relations.father_id': 1 });
MemberSchema.index({ 'family_lineage_links.immediate_relations.mother_id': 1 });
MemberSchema.index({ 'family_lineage_links.immediate_relations.spouse_id': 1 });
MemberSchema.index({ 'family_lineage_links.extended_network.paternal.dada_id': 1 });
MemberSchema.index({ 'family_lineage_links.extended_network.maternal.nana_id': 1 });

// Compound index for pagination optimization (cursor-based)
MemberSchema.index({ createdAt: -1, _id: 1 });

// ============================================
// Dashboard-specific Indexes (NEW)
// ============================================
// For gender count queries in dashboard stats
MemberSchema.index({ gender: 1 });

// For matrimony eligible members query (unmarried members by age)
MemberSchema.index({ gender: 1, maritalStatus: 1, dob: 1 });

// For unique family count
MemberSchema.index({ familyId: 1 });

module.exports = mongoose.model('Member', MemberSchema);
