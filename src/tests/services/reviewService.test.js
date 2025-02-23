const { pool } = require('../../db');
const reviewService = require('../../services/reviewService');
const { createTestUser } = require('../helpers/userHelpers');
const { createTestSkill } = require('../helpers/skillHelpers');
const { createTestReview, cleanupTestReviews } = require('../helpers/reviewHelpers');

describe('Review Service', () => {
  afterAll(async () => {
    await cleanupTestReviews();
    await pool.end();
  });

  describe('createReview', () => {
    it('should create a review and update karma', async () => {
      const reviewer = await createTestUser();
      const reviewed = await createTestUser();
      const skill = await createTestSkill({ user_id: reviewed.id });

      const review = await reviewService.createReview(
        reviewer.id,
        reviewed.id,
        skill.id,
        'Test Title',
        'Test content that is long enough'
      );

      expect(review).toMatchObject({
        reviewer_id: reviewer.id,
        reviewed_id: reviewed.id,
        skill_id: skill.id,
        title: 'Test Title',
        content: 'Test content that is long enough'
      });
    });

    it('should throw error for invalid skill', async () => {
      const reviewer = await createTestUser();
      const reviewed = await createTestUser();

      await expect(
        reviewService.createReview(
          reviewer.id,
          reviewed.id,
          999999, // Invalid skill ID
          'Test Title',
          'Test content'
        )
      ).rejects.toThrow('Invalid skill or user combination');
    });
  });

  describe('verifyReview', () => {
    it('should verify a review', async () => {
      const { review } = await createTestReview();

      const verifiedReview = await reviewService.verifyReview(review.id);

      expect(verifiedReview.is_verified).toBe(true);
      expect(verifiedReview.updated_at).not.toBe(review.updated_at);
    });

    it('should throw error for non-existent review', async () => {
      await expect(
        reviewService.verifyReview(999999)
      ).rejects.toThrow('Review not found');
    });
  });
}); 