const redisService = require('./redisService');
const { AppError } = require('../utils/errorHandler');

const RATE_LIMIT_TYPES = {
  API: 'api',
  AUTH: 'auth',
  PROFILE: 'profile',
  SKILL: 'skill',
  MATCH: 'match',
  RATING: 'rating',
  REVIEW: 'review',
  REPORT: 'report',
  UPLOAD: 'upload',
  SEARCH: 'search'
};

const rateLimiterService = {
  /**
   * Check rate limit for a specific action
   */
  async checkRateLimit(key, limit, windowMs) {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
    
    const multi = redisService.client.multi();
    multi.incr(windowKey);
    multi.pexpire(windowKey, windowMs);
    
    const [count] = await multi.exec();
    
    if (count > limit) {
      throw new AppError('Rate limit exceeded', 429);
    }
    
    return {
      remaining: limit - count,
      reset: Math.ceil((Math.floor(now / windowMs) + 1) * windowMs / 1000)
    };
  },

  /**
   * Create rate limit middleware
   */
  createRateLimiter(type, { windowMs, max, keyGenerator }) {
    return async (req, res, next) => {
      try {
        const key = keyGenerator 
          ? keyGenerator(req) 
          : `${type}:${req.ip}`;

        const result = await this.checkRateLimit(key, max, windowMs);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': max,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': result.reset
        });

        next();
      } catch (error) {
        if (error.statusCode === 429) {
          res.set({
            'X-RateLimit-Limit': max,
            'X-RateLimit-Remaining': 0,
            'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + windowMs / 1000)
          });
        }
        next(error);
      }
    };
  },

  /**
   * Create sliding window rate limiter
   */
  createSlidingWindowLimiter(type, { windowMs, max, keyGenerator }) {
    return async (req, res, next) => {
      try {
        const now = Date.now();
        const key = keyGenerator 
          ? keyGenerator(req) 
          : `${type}:${req.ip}`;
        const windowKey = `slidingwindow:${key}`;

        // Clean old requests and add new one
        const multi = redisService.client.multi();
        multi.zremrangebyscore(windowKey, 0, now - windowMs);
        multi.zadd(windowKey, now, `${now}-${Math.random()}`);
        multi.zcard(windowKey);
        multi.pexpire(windowKey, windowMs);

        const [, , count] = await multi.exec();

        if (count > max) {
          throw new AppError('Rate limit exceeded', 429);
        }

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': max,
          'X-RateLimit-Remaining': Math.max(0, max - count),
          'X-RateLimit-Reset': Math.ceil((now + windowMs) / 1000)
        });

        next();
      } catch (error) {
        next(error);
      }
    };
  },

  /**
   * Create token bucket rate limiter
   */
  async createTokenBucketLimiter(type, { capacity, refillRate, keyGenerator }) {
    return async (req, res, next) => {
      try {
        const now = Date.now();
        const key = keyGenerator 
          ? keyGenerator(req) 
          : `${type}:${req.ip}`;
        const bucketKey = `tokenbucket:${key}`;

        const bucket = await redisService.client.hGetAll(bucketKey);
        const tokens = parseInt(bucket.tokens || capacity);
        const lastRefill = parseInt(bucket.lastRefill || now);

        // Calculate token refill
        const timePassed = now - lastRefill;
        const refillAmount = Math.floor(timePassed * (refillRate / 1000));
        const newTokens = Math.min(capacity, tokens + refillAmount);

        if (newTokens < 1) {
          throw new AppError('Rate limit exceeded', 429);
        }

        // Update bucket
        await redisService.client
          .multi()
          .hSet(bucketKey, {
            tokens: newTokens - 1,
            lastRefill: now
          })
          .pExpire(bucketKey, Math.ceil(capacity / refillRate * 1000))
          .exec();

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': capacity,
          'X-RateLimit-Remaining': newTokens - 1,
          'X-RateLimit-Reset': Math.ceil(now / 1000 + (1 / refillRate))
        });

        next();
      } catch (error) {
        next(error);
      }
    };
  }
};

module.exports = {
  rateLimiterService,
  RATE_LIMIT_TYPES
}; 