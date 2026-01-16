const mongoose = require('mongoose');

const MarriageSchema = new mongoose.Schema({
    husbandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    wifeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    marriageDate: { type: Date },
    status: { type: String, enum: ['Active', 'Divorced', 'Widowed'], default: 'Active' },
}, {
    timestamps: true
});

// Index for fast lookups
MarriageSchema.index({ husbandId: 1 });
MarriageSchema.index({ wifeId: 1 });
MarriageSchema.index({ husbandId: 1, wifeId: 1 }, { unique: true });

module.exports = mongoose.model('Marriage', MarriageSchema);
