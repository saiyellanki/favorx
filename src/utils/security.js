const crypto = require('crypto');
const config = require('../config/config');

const security = {
  /**
   * Generate cryptographically secure random string
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  },

  /**
   * Hash sensitive data
   */
  hashData(data) {
    return crypto
      .createHash('sha256')
      .update(data + config.hashSecret)
      .digest('hex');
  },

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const errors = [];
    if (password.length < minLength) errors.push('Password too short');
    if (!hasUpperCase) errors.push('Missing uppercase letter');
    if (!hasLowerCase) errors.push('Missing lowercase letter');
    if (!hasNumbers) errors.push('Missing number');
    if (!hasSpecialChar) errors.push('Missing special character');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Sanitize error messages to prevent information leakage
   */
  sanitizeError(error) {
    const sensitiveFields = ['password', 'token', 'key', 'secret'];
    const sanitized = { ...error };
    
    if (sanitized.stack && config.env === 'production') {
      delete sanitized.stack;
    }

    if (sanitized.message) {
      sensitiveFields.forEach(field => {
        const regex = new RegExp(`${field}[^\\s]*`, 'gi');
        sanitized.message = sanitized.message.replace(regex, '[REDACTED]');
      });
    }

    return sanitized;
  }
};

module.exports = security; 