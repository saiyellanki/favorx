const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { AppError } = require('../utils/appError');

const auth = {
  // Verify JWT token
  requireAuth: (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        throw new AppError('No token provided', 401);
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;
      if (Date.now() >= decoded.exp * 1000) {
        throw new AppError('Token expired', 401);
      }
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Invalid token', 401);
      } else if (error.name === 'TokenExpiredError') {
        throw new AppError('Token expired', 401);
      }
      throw error;
    }
  },

  // Optional auth - doesn't require token but will process it if present
  optionalAuth: (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;
      } catch (err) {
        // Invalid token, but we don't return error for optional auth
        req.user = null;
      }
    }
    next();
  }
};

module.exports = auth; 