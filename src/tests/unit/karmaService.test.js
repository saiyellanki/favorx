const karmaService = require('../../services/karmaService');
const { createTestUser } = require('../helpers/userHelpers');
const { createTestRating } = require('../helpers/ratingHelpers');
const { createTestSkill } = require('../helpers/skillHelpers');

describe('Karma Service', () => {
  describe('calculateWeightedRating', () => {
    it('should weigh recent ratings more heavily', async () => {
      const user = await createTestUser();
      
      // Create old rating (5 stars)
      await createTestRating({
        rated_id: user.id,
        rating: 5,
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
      });

      // Create recent rating (3 stars)
      await createTestRating({
        rated_id: user.id,
        rating: 3,
        created_at: new Date() // Now
      });

      const weightedRating = await karmaService.calculateWeightedRating(user.id);
      
      // Recent 3-star should weigh more than old 5-star
      expect(weightedRating).toBeLessThan(4);
    });

    it('should handle users with no ratings', async () => {
      const user = await createTestUser();
      const rating = await karmaService.calculateWeightedRating(user.id);
      expect(rating).toBe(karmaService.KARMA_WEIGHTS.INITIAL_KARMA);
    });
  });

  describe('calculateCompletionScore', () => {
    it('should calculate based on successful favor ratio', async () => {
      const user = await createTestUser();
      const skill = await createTestSkill({ user_id: user.id });

      // Create 3 successful (rating >= 4) and 2 unsuccessful ratings
      await Promise.all([
        createTestRating({ rated_id: user.id, skill_id: skill.id, rating: 5 }),
        createTestRating({ rated_id: user.id, skill_id: skill.id, rating: 4 }),
        createTestRating({ rated_id: user.id, skill_id: skill.id, rating: 4 }),
        createTestRating({ rated_id: user.id, skill_id: skill.id, rating: 2 }),
        createTestRating({ rated_id: user.id, skill_id: skill.id, rating: 1 })
      ]);

      const completionScore = await karmaService.calculateCompletionScore(user.id);
      expect(completionScore).toBe(3); // (3/5) * 5 = 3
    });
  });

  describe('calculateConsistencyScore', () => {
    it('should reward consistent ratings', async () => {
      const user = await createTestUser();

      // Create very consistent ratings (all 4 stars)
      await Promise.all(Array(5).fill().map(() =>
        createTestRating({ rated_id: user.id, rating: 4 })
      ));

      const consistentScore = await karmaService.calculateConsistencyScore(user.id);
      const consistentScoreValue = parseFloat(consistentScore);

      // Create inconsistent ratings (mix of 1 and 5 stars)
      await Promise.all([
        createTestRating({ rated_id: user.id, rating: 1 }),
        createTestRating({ rated_id: user.id, rating: 5 }),
        createTestRating({ rated_id: user.id, rating: 1 }),
        createTestRating({ rated_id: user.id, rating: 5 })
      ]);

      const inconsistentScore = await karmaService.calculateConsistencyScore(user.id);
      const inconsistentScoreValue = parseFloat(inconsistentScore);

      expect(consistentScoreValue).toBeGreaterThan(inconsistentScoreValue);
    });
  });

  describe('calculateActivityScore', () => {
    it('should reward recent activity', async () => {
      const user = await createTestUser();

      // Create recent activities
      await Promise.all([
        createTestSkill({ user_id: user.id }),
        createTestRating({ rated_id: user.id }),
        createTestRating({ rated_id: user.id })
      ]);

      const activityScore = await karmaService.calculateActivityScore(user.id);
      expect(activityScore).toBeGreaterThan(0);
    });

    it('should not count old activity', async () => {
      const user = await createTestUser();

      // Create old activities (more than 30 days ago)
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await Promise.all([
        createTestSkill({ user_id: user.id, created_at: oldDate }),
        createTestRating({ rated_id: user.id, created_at: oldDate })
      ]);

      const activityScore = await karmaService.calculateActivityScore(user.id);
      expect(activityScore).toBe(0);
    });
  });

  describe('calculateKarmaScore', () => {
    it('should combine all factors with proper weights', async () => {
      const user = await createTestUser();
      const skill = await createTestSkill({ user_id: user.id });

      // Create a mix of ratings and activity
      await Promise.all([
        createTestRating({ rated_id: user.id, skill_id: skill.id, rating: 5 }),
        createTestRating({ rated_id: user.id, skill_id: skill.id, rating: 4 }),
        createTestSkill({ user_id: user.id })
      ]);

      const karmaScore = await karmaService.calculateKarmaScore(user.id);

      expect(karmaScore).toBeGreaterThan(0);
      expect(karmaScore).toBeLessThanOrEqual(5);

      // Verify weights
      const {
        RATING,
        COMPLETION,
        CONSISTENCY,
        ACTIVITY
      } = karmaService.KARMA_WEIGHTS;

      expect(RATING + COMPLETION + CONSISTENCY + ACTIVITY).toBe(1);
    });

    it('should cache karma score', async () => {
      const user = await createTestUser();
      
      // Calculate karma score
      const karmaScore = await karmaService.calculateKarmaScore(user.id);

      // Check if score is cached
      const cachedScore = await redisService.client.get(`karma:${user.id}`);
      expect(parseFloat(cachedScore)).toBe(karmaScore);
    });
  });
}); 