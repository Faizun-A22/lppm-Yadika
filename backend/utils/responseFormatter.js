/**
 * Format success response
 * @param {string} status - Status response (success/error)
 * @param {string} message - Message to display
 * @param {any} data - Data to send
 * @param {object} meta - Additional metadata (pagination, etc)
 * @returns {object} Formatted response object
 */
const formatResponse = (status = 'success', message = '', data = null, meta = null) => {
    const response = {
        success: status === 'success',
        message: message
    };

    if (data !== null) {
        response.data = data;
    }

    if (meta !== null) {
        response.meta = meta;
    }

    return response;
};

/**
 * Format error response
 * @param {string} message - Error message
 * @param {array} errors - Validation errors array
 * @param {number} code - Error code
 * @returns {object} Formatted error response
 */
const formatError = (message = 'Terjadi kesalahan', errors = null, code = null) => {
    const response = {
        success: false,
        message: message
    };

    if (errors !== null) {
        response.errors = errors;
    }

    if (code !== null) {
        response.code = code;
    }

    return response;
};

/**
 * Format pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {object} Pagination metadata
 */
const formatPagination = (page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    
    return {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_items: parseInt(total),
        total_pages: totalPages,
        has_next: parseInt(page) < totalPages,
        has_prev: parseInt(page) > 1
    };
};

/**
 * Format validation errors from express-validator
 * @param {array} errors - Validation errors array
 * @returns {array} Formatted validation errors
 */
const formatValidationErrors = (errors) => {
    return errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
    }));
};

/**
 * Create success response with pagination
 * @param {array} data - Data array
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @param {string} message - Success message
 * @returns {object} Formatted response with pagination
 */
const formatPaginatedResponse = (data, page, limit, total, message = 'Data berhasil diambil') => {
    const pagination = formatPagination(page, limit, total);
    
    return {
        success: true,
        message: message,
        data: data,
        pagination: pagination
    };
};

module.exports = {
    formatResponse,
    formatError,
    formatPagination,
    formatValidationErrors,
    formatPaginatedResponse
};