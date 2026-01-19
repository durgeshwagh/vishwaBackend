/**
 * Reusable Pagination Utility for MongoDB Queries
 * Provides consistent pagination across all list endpoints
 */

/**
 * Paginate a Mongoose query
 * @param {Model} Model - Mongoose model
 * @param {Object} query - MongoDB query object
 * @param {Object} options - Pagination options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 50, max: 100)
 * @param {string} options.select - Fields to select
 * @param {Object} options.sort - Sort object (default: { createdAt: -1 })
 * @param {Object} options.populate - Population options
 * @param {boolean} options.lean - Use lean for better performance (default: true)
 * @returns {Promise<Object>} - { data, pagination }
 */
async function paginate(Model, query = {}, options = {}) {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 50)); // Max 100, min 1
    const skip = (page - 1) * limit;

    // Build query
    let queryBuilder = Model.find(query);

    // Apply select
    if (options.select) {
        queryBuilder = queryBuilder.select(options.select);
    }

    // Apply sort (default: newest first)
    const sort = options.sort || { createdAt: -1 };
    queryBuilder = queryBuilder.sort(sort);

    // Apply pagination
    queryBuilder = queryBuilder.skip(skip).limit(limit);

    // Apply populate if provided
    if (options.populate) {
        if (Array.isArray(options.populate)) {
            options.populate.forEach(pop => {
                queryBuilder = queryBuilder.populate(pop);
            });
        } else {
            queryBuilder = queryBuilder.populate(options.populate);
        }
    }

    // Apply lean for better performance (read-only)
    if (options.lean !== false) {
        queryBuilder = queryBuilder.lean();
    }

    // Execute query and count in parallel for better performance
    const [data, total] = await Promise.all([
        queryBuilder.exec(),
        Model.countDocuments(query)
    ]);

    return {
        data,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
        }
    };
}

/**
 * Build query from request filters
 * @param {Object} filters - Filter object from req.query
 * @param {Array} allowedFilters - Array of allowed filter keys
 * @returns {Object} - MongoDB query object
 */
function buildQuery(filters, allowedFilters = []) {
    const query = {};

    allowedFilters.forEach(key => {
        if (filters[key]) {
            // Handle array filters (e.g., ?role=Admin,Member)
            if (filters[key].includes(',')) {
                query[key] = { $in: filters[key].split(',') };
            } else {
                query[key] = filters[key];
            }
        }
    });

    // Handle search query (text search)
    if (filters.search) {
        query.$text = { $search: filters.search };
    }

    return query;
}

module.exports = {
    paginate,
    buildQuery
};
