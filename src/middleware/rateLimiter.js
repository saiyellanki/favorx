const { rateLimiterService, RATE_LIMIT_TYPES } = require('../services/rateLimiterService');
const { redisService } = require('../services/redisService');
const { config } = require('../config');
const { AppError } = require('../utils/appError');

const rateLimiter = {
  // General API rate limit
  api: rateLimiterService.createRateLimiter(RATE_LIMIT_TYPES.API, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    keyGenerator: (req) => {
      return req.user ? `${req.ip}-${req.user.id}` : req.ip;
    },
    skip: (req) => {
      return config.trustedIps.includes(req.ip);
    }
  }),

  // Authentication rate limit (sliding window)
  auth: rateLimiterService.createSlidingWindowLimiter(RATE_LIMIT_TYPES.AUTH, {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Reduce max attempts
    keyGenerator: (req) => `${RATE_LIMIT_TYPES.AUTH}:${req.ip}:${req.body.email}`,
    handler: async (req, res, next) => {
      const retryAfter = await redisService.incrRetryDelay(req.ip);
      res.set('Retry-After', retryAfter);
      next(new AppError('Too many login attempts', 429));
    }
  }),

  // Profile updates rate limit
  profileUpdate: rateLimiterService.createRateLimiter(RATE_LIMIT_TYPES.PROFILE, {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // 10 updates per hour
  }),

  // Search rate limit (token bucket)
  search: rateLimiterService.createTokenBucketLimiter(RATE_LIMIT_TYPES.SEARCH, {
    capacity: 30,
    refillRate: 1, // 1 token per second
    keyGenerator: (req) => `${RATE_LIMIT_TYPES.SEARCH}:${req.user?.id || req.ip}`
  }),

  // Skill matching rate limit
  matching: rateLimiterService.createRateLimiter(RATE_LIMIT_TYPES.MATCH, {
    windowMs: 60 * 1000, // 1 minute
    max: 20 // 20 matches per minute
  }),

  // Skill creation rate limit
  skillCreate: rateLimiterService.createRateLimiter(RATE_LIMIT_TYPES.SKILL, {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // 10 skill creations per hour
  }),

  // Skill update rate limit
  skillUpdate: rateLimiterService.createRateLimiter(RATE_LIMIT_TYPES.SKILL, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15 // 15 skill updates per 15 minutes
  }),

  // Rating creation rate limit
  ratingCreate: rateLimiterService.createRateLimiter(RATE_LIMIT_TYPES.RATING, {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // 10 ratings per hour
  }),

  // Review creation rate limit
  reviewCreate: rateLimiterService.createRateLimiter(RATE_LIMIT_TYPES.REVIEW, {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5 // 5 reviews per day
  }),

  // Report creation rate limit
  reportCreate: rateLimiterService.createRateLimiter(RATE_LIMIT_TYPES.REPORT, {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5 // 5 reports per hour
  }),

  // Image upload rate limit
  imageUpload: rateLimiterService.createRateLimiter(RATE_LIMIT_TYPES.UPLOAD, {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5 // 5 uploads per hour
  })
};

module.exports = rateLimiter; 