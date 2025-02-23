const redisService = require('./redisService');
const { AppError } = require('../utils/errorHandler');

const rateLimitService = {
  checkRateLimit: async (key, limit, windowMs) => {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
    
    const count = await redisService.client.incr(windowKey);
    if (count === 1) {
      await redisService.client.expire(windowKey, Math.ceil(windowMs / 1000));
    }
    
    if (count > limit) {
      throw new AppError('Rate limit exceeded', 429);
    }
    
    return {
      remaining: limit - count,
      reset: Math.ceil((Math.floor(now / windowMs) + 1) * windowMs / 1000)
    };
  },

  matchingLimit: async (userId) => {
    return rateLimitService.checkRateLimit(
      `matching:${userId}`,
      20, // 20 requests
      60 * 1000 // per minute
    );
  },

  skillCreateLimit: async (userId) => {
    return rateLimitService.checkRateLimit(
      `skill_create:${userId}`,
      10, // 10 creations
      60 * 60 * 1000 // per hour
    );
  },

  skillUpdateLimit: async (userId) => {
    return rateLimitService.checkRateLimit(
      `skill_update:${userId}`,
      15, // 15 updates
      15 * 60 * 1000 // per 15 minutes
    );
  }
};

module.exports = rateLimitService; 