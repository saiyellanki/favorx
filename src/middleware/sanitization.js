const sanitizer = require('../utils/sanitizer');

const sanitizationMiddleware = {
  /**
   * Sanitize request body
   */
  sanitizeBody: (req, res, next) => {
    if (req.body) {
      req.body = sanitizer.sanitizeObject(req.body);
    }
    next();
  },

  /**
   * Sanitize request query parameters
   */
  sanitizeQuery: (req, res, next) => {
    if (req.query) {
      req.query = sanitizer.sanitizeParams(req.query);
    }
    next();
  },

  /**
   * Sanitize request parameters
   */
  sanitizeParams: (req, res, next) => {
    if (req.params) {
      req.params = sanitizer.sanitizeParams(req.params);
    }
    next();
  },

  /**
   * Sanitize file uploads
   */
  sanitizeFiles: (req, res, next) => {
    if (req.files) {
      req.files = req.files.map(file => ({
        ...file,
        originalname: sanitizer.sanitizeFileName(file.originalname)
      }));
    }
    if (req.file) {
      req.file.originalname = sanitizer.sanitizeFileName(req.file.originalname);
    }
    next();
  }
};

module.exports = sanitizationMiddleware; 