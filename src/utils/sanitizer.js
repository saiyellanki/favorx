const xss = require('xss');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const { window } = new JSDOM('');
const DOMPurify = createDOMPurify(window);

// Configure XSS options
const xssOptions = {
  whiteList: {}, // No tags allowed by default
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script'] // Strip script tags and their content
};

// Configure DOMPurify options for rich text
const domPurifyOptions = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'li'],
  ALLOWED_ATTR: ['href'],
  ALLOW_DATA_ATTR: false
};

const sanitizer = {
  /**
   * Sanitize plain text input
   */
  sanitizeText(text) {
    if (!text) return text;
    return xss(text.toString().trim(), xssOptions);
  },

  /**
   * Sanitize rich text input (HTML)
   */
  sanitizeRichText(html) {
    if (!html) return html;
    return DOMPurify.sanitize(html.toString(), domPurifyOptions);
  },

  /**
   * Sanitize object properties recursively
   */
  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else if (typeof value === 'string') {
        // Check if the field should allow rich text
        if (key === 'content' || key === 'description') {
          sanitized[key] = this.sanitizeRichText(value);
        } else {
          sanitized[key] = this.sanitizeText(value);
        }
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  },

  /**
   * Sanitize URL parameters
   */
  sanitizeParams(params) {
    const sanitized = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Only allow alphanumeric characters and some special chars in params
        sanitized[key] = value.replace(/[^a-zA-Z0-9-_. ]/g, '');
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  },

  /**
   * Validate and sanitize file names
   */
  sanitizeFileName(fileName) {
    if (!fileName) return fileName;
    // Remove path traversal attempts and invalid characters
    return fileName
      .toString()
      .replace(/^.*[/\\]/, '') // Remove path
      .replace(/[^a-zA-Z0-9-_. ]/g, '') // Remove invalid chars
      .replace(/\.\./g, ''); // Remove path traversal
  }
};

module.exports = sanitizer; 