const { pool } = require('../../db');
const redisService = require('../../services/redisService');

// Setup test environment
process.env.NODE_ENV = 'test';

// Global setup
beforeAll(async () => {
  // Connect to test database
  await pool.connect();
  // Connect to Redis
  await redisService.connect();
});

// Global teardown
afterAll(async () => {
  // Close database connection
  await pool.end();
  // Close Redis connection
  await redisService.disconnect();
});

// Clear database and cache between tests
beforeEach(async () => {
  // Clear test database tables
  await pool.query(`
    TRUNCATE users, profiles, skills, ratings, reviews, 
    verification_tokens, trust_verifications, verification_documents,
    reports, moderation_actions CASCADE
  `);
  
  // Clear Redis cache
  await redisService.client.flushDb();
}); 