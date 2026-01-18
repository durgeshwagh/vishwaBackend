// Family Relationship API Endpoints

/**
 * GET /api/members/eligible-relations
 * Returns members eligible for various relationship types
 * Query params: type (father, mother, spouse, sibling, dada, nana, etc.)
 */
router.get('/eligible-relations', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        const { type, gender, excludeId } = req.query;
        let query = {};

        // Filter based on relationship type
        switch (type) {
            case 'father':
            case 'dada':
            case 'nana':
                query.gender = 'Male';
                break;
            case 'mother':
            case 'dadi':
            case 'nani':
                query.gender = 'Female';
                break;
            case 'spouse':
                query.gender = gender === 'Male' ? 'Female' : 'Male';
                query.maritalStatus = { $in: ['Single', 'Married'] }; // Allow married for edge cases
                break;
            case 'kaka':
            case 'mama':
            case 'fufa':
            case 'mausa':
            case 'jija':
            case 'saala':
                query.gender = 'Male';
                break;
            case 'kaki':
            case 'bua':
            case 'mami':
            case 'mausi':
            case 'saali':
                query.gender = 'Female';
                break;
            default:
                // No specific filter
                break;
        }

        // Exclude current member
        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const members = await Member.find(query)
            .select('_id memberId firstName middleName lastName gender dob maritalStatus city village')
            .sort({ firstName: 1 })
            .limit(200)
            .lean();

        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/members/:id/family-network
 * Get complete family network for a specific member
 */
router.get('/:id/family-network', verifyToken, checkPermission('member.view'), async (req, res) => {
    try {
        const memberId = req.params.id;
        const member = await Member.findById(memberId)
            .populate('family_lineage_links.immediate_relations.father_id')
            .populate('family_lineage_links.immediate_relations.mother_id')
            .populate('family_lineage_links.immediate_relations.spouse_id')
            .populate('family_lineage_links.immediate_relations.siblings_ids')
            .populate('family_lineage_links.immediate_relations.children_ids')
            .populate('family_lineage_links.extended_network.paternal.dada_id')
            .populate('family_lineage_links.extended_network.paternal.dadi_id')
            .populate('family_lineage_links.extended_network.paternal.kaka_ids')
            .populate('family_lineage_links.extended_network.paternal.kaki_ids')
            .populate('family_lineage_links.extended_network.paternal.bua_ids')
            .populate('family_lineage_links.extended_network.paternal.fufa_ids')
            .populate('family_lineage_links.extended_network.maternal.nana_id')
            .populate('family_lineage_links.extended_network.maternal.nani_id')
            .populate('family_lineage_links.extended_network.maternal.mama_ids')
            .populate('family_lineage_links.extended_network.maternal.mami_ids')
            .populate('family_lineage_links.extended_network.maternal.mausi_ids')
            .populate('family_lineage_links.extended_network.maternal.mausa_ids')
            .populate('family_lineage_links.extended_network.in_laws.father_in_law_id')
            .populate('family_lineage_links.extended_network.in_laws.mother_in_law_id')
            .populate('family_lineage_links.extended_network.in_laws.jija_ids')
            .populate('family_lineage_links.extended_network.in_laws.saala_ids')
            .populate('family_lineage_links.extended_network.in_laws.saali_ids')
            .lean();

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        res.json({
            member: {
                _id: member._id,
                name: `${member.firstName} ${member.lastName}`,
                memberId: member.memberId
            },
            immediate_relations: member.family_lineage_links?.immediate_relations || {},
            paternal: member.family_lineage_links?.extended_network?.paternal || {},
            maternal: member.family_lineage_links?.extended_network?.maternal || {},
            in_laws: member.family_lineage_links?.extended_network?.in_laws || {}
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
