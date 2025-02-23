const { pool } = require('../../db');
const karmaService = require('../../services/karmaService');
const { createTestUser } = require('../helpers/userHelpers');
const { createTestRating } = require('../helpers/ratingHelpers');

describe('Karma Service', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('calculateWeightedRating', () => {
    it('should calculate weighted rating correctly', async () => {
      const user = await createTestUser();
      
      // Create ratings with different timestamps
      await createTestRating({
        rated_id: user.id,
        rating: 5,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      });
      await createTestRating({
        rated_id: user.id,
        rating: 4,
        created_at: new Date() // Now
      });

      const weightedRating = await karmaService.calculateWeightedRating(user.id);
      expect(weightedRating).toBeGreaterThan(4); // Recent 4 should weigh more than old 5
    });

    it('should return initial karma for new users', async () => {
      const newUser = await createTestUser();
      const rating = await karmaService.calculateWeightedRating(newUser.id);
      expect(rating).toBe(karmaService.KARMA_WEIGHTS.INITIAL_KARMA);
    });
  });

  describe('calculateKarmaScore', () => {
    it('should combine all factors into final karma score', async () => {
      const user = await createTestUser();
      
      // Create some activity
      await Promise.all([
        createTestRating({ rated_id: user.id, rating: 5 }),
        createTestRating({ rated_id: user.id, rating: 4 }),
        createTestRating({ rated_id: user.id, rating: 5 })
      ]);

      const karmaScore = await karmaService.calculateKarmaScore(user.id);
      
      expect(karmaScore).toBeGreaterThan(0);
      expect(karmaScore).toBeLessThanOrEqual(5);
    });
  });
}); 