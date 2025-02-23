const { body, query, param, validationResult } = require('express-validator');
const sanitizer = require('../utils/sanitizer');
const { isDisposableEmail } = require('../utils/emailUtils');

const validators = {
  // Validation rules for user registration
  registerValidation: [
    body('username')
      .trim()
      .customSanitizer(value => sanitizer.sanitizeText(value))
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers and underscores')
      .not().matches(/^admin/i)
      .withMessage('Username cannot start with admin'),
    
    body('email')
      .trim()
      .customSanitizer(value => sanitizer.sanitizeText(value))
      .isEmail()
      .normalizeEmail()
      .custom(async value => {
        if (await isDisposableEmail(value)) {
          throw new Error('Disposable email addresses not allowed');
        }
        return true;
      })
      .withMessage('Must be a valid email address'),
    
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
  ],

  // Validation rules for login
  loginValidation: [
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Must be a valid email address'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],

  // Middleware to check validation results
  validate: (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },

  // Profile validation rules
  profileValidation: [
    body('full_name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio cannot exceed 500 characters'),
    
    body('location')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Location cannot exceed 100 characters'),
  ],

  // Image upload validation
  imageValidation: (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only JPEG, PNG and GIF images are allowed' 
      });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 5MB' 
      });
    }

    next();
  },

  // Skill validation rules
  skillValidation: [
    body('category')
      .trim()
      .notEmpty()
      .withMessage('Category is required')
      .isLength({ max: 50 })
      .withMessage('Category cannot exceed 50 characters'),
    
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Title must be between 3 and 100 characters'),
    
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters'),
    
    body('effort_time')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Effort time must be a positive integer'),
    
    body('is_offering')
      .optional()
      .isBoolean()
      .withMessage('Is offering must be a boolean')
  ],

  // Rating validation rules
  ratingValidation: [
    body('rated_id')
      .isInt({ min: 1 })
      .withMessage('Invalid user ID'),
    
    body('skill_id')
      .isInt({ min: 1 })
      .withMessage('Invalid skill ID'),
    
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    
    body('review')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Review cannot exceed 500 characters')
  ],

  // Review validation rules
  reviewValidation: [
    body('reviewed_id')
      .isInt({ min: 1 })
      .withMessage('Invalid user ID'),
    
    body('skill_id')
      .isInt({ min: 1 })
      .withMessage('Invalid skill ID'),
    
    body('title')
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Title must be between 3 and 100 characters'),
    
    body('content')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Content must be between 10 and 1000 characters')
  ],

  // Verification validation rules
  verificationValidation: [
    body('type')
      .notEmpty()
      .withMessage('Verification type is required'),
    
    body('full_name')
      .if(body('type').equals('id'))
      .notEmpty()
      .withMessage('Full name is required for ID verification'),
    
    body('address')
      .if(body('type').equals('address'))
      .notEmpty()
      .withMessage('Address is required for address verification'),
    
    body('credentials')
      .if(body('type').equals('professional'))
      .notEmpty()
      .withMessage('Professional credentials are required')
  ],

  // Report validation rules
  reportValidation: [
    body('reported_id')
      .isInt({ min: 1 })
      .withMessage('Invalid user ID'),
    
    body('type')
      .isIn(Object.values(REPORT_TYPES))
      .withMessage('Invalid report type'),
    
    body('target_id')
      .isInt({ min: 1 })
      .withMessage('Invalid target ID'),
    
    body('reason')
      .isIn(Object.values(REPORT_REASONS))
      .withMessage('Invalid report reason'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters')
  ],

  // Moderation validation rules
  moderationValidation: [
    body('action')
      .isIn(Object.values(MODERATION_ACTIONS))
      .withMessage('Invalid moderation action'),
    
    body('reason')
      .trim()
      .notEmpty()
      .withMessage('Moderation reason is required')
      .isLength({ max: 500 })
      .withMessage('Reason cannot exceed 500 characters'),
    
    body('duration')
      .optional()
      .isString()
      .matches(/^(\d+)\s+(days?|weeks?|months?)$/)
      .withMessage('Invalid duration format (e.g., "7 days", "2 weeks")')
  ],
};

module.exports = validators; 