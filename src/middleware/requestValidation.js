const { AppError } = require('../utils/errorHandler');
const security = require('../utils/security');

const requestValidation = {
  /**
   * Validate request content type
   */
  validateContentType: (allowedTypes) => {
    return (req, res, next) => {
      const contentType = req.headers['content-type'];
      if (!contentType || !allowedTypes.includes(contentType.split(';')[0])) {
        throw new AppError(`Invalid content type. Allowed types: ${allowedTypes.join(', ')}`, 415);
      }
      next();
    };
  },

  /**
   * Validate request size
   */
  validateRequestSize: (maxSize) => {
    return (req, res, next) => {
      const size = parseInt(req.headers['content-length'] || 0);
      if (size > maxSize) {
        throw new AppError(`Request too large. Maximum size: ${maxSize} bytes`, 413);
      }
      next();
    };
  },

  /**
   * Validate required fields
   */
  validateRequiredFields: (fields) => {
    return (req, res, next) => {
      const missing = fields.filter(field => !req.body[field]);
      if (missing.length > 0) {
        throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
      }
      next();
    };
  },

  /**
   * Validate request parameters
   */
  validateParams: (schema) => {
    return (req, res, next) => {
      const errors = [];
      for (const [param, rules] of Object.entries(schema)) {
        const value = req.params[param];
        if (rules.required && !value) {
          errors.push(`Missing required parameter: ${param}`);
          continue;
        }
        if (rules.type && typeof value !== rules.type) {
          errors.push(`Invalid type for parameter ${param}`);
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Invalid format for parameter ${param}`);
        }
      }
      if (errors.length > 0) {
        throw new AppError(errors.join(', '), 400);
      }
      next();
    };
  }
};

module.exports = requestValidation; 