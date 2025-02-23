const reviewService = require('../../services/reviewService');
const { createTestUser } = require('../helpers/userHelpers');
const { createTestSkill } = require('../helpers/skillHelpers');
const { createTestReview } = require('../helpers/reviewHelpers');

describe('Review Service', () => {
  describe('createReview', () => {
    it('should create a new review', async () => {
      const reviewer = await createTestUser();
      const reviewed = await createTestUser();
      const skill = await createTestSkill({ user_id: reviewed.id });

      const review = await reviewService.createReview(
        reviewer.id,
        reviewed.id,
        skill.id,
        'Great Experience',
        'Very professional and skilled'
      );

      expect(review).toMatchObject({
        reviewer_id: reviewer.id,
        reviewed_id: reviewed.id,
        skill_id: skill.id,
        title: 'Great Experience',
        content: 'Very professional and skilled'
      });
    });

    it('should prevent duplicate reviews', async () => {
      const reviewer = await createTestUser();
      const reviewed = await createTestUser();
      const skill = await createTestSkill({ user_id: reviewed.id });

      await reviewService.createReview(
        reviewer.id,
        reviewed.id,
        skill.id,
        'First Review',
        'Good service'
      );

      await expect(
        reviewService.createReview(
          reviewer.id,
          reviewed.id,
          skill.id,
          'Second Review',
          'Still good'
        )
      ).rejects.toThrow('You have already reviewed this skill');
    });

    it('should validate skill ownership', async () => {
      const reviewer = await createTestUser();
      const reviewed = await createTestUser();
      const wrongUser = await createTestUser();
      const skill = await createTestSkill({ user_id: wrongUser.id });

      await expect(
        reviewService.createReview(
          reviewer.id,
          reviewed.id,
          skill.id,
          'Invalid Review',
          'Should fail'
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

    it('should update karma score after verification', async () => {
      const { review, reviewed } = await createTestReview();

      const oldKarma = await karmaService.calculateKarmaScore(reviewed.id);
      await reviewService.verifyReview(review.id);
      const newKarma = await karmaService.calculateKarmaScore(reviewed.id);

      expect(newKarma).not.toBe(oldKarma);
    });
  });

  describe('getUserReviews', () => {
    it('should return paginated reviews', async () => {
      const user = await createTestUser();
      
      // Create multiple reviews
      await Promise.all(Array(15).fill().map(() =>
        createTestReview({ reviewed_id: user.id })
      ));

      const result = await reviewService.getUserReviews(user.id, 1, 10);

      expect(result.reviews).toHaveLength(10);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 10,
        totalItems: 15,
        totalPages: 2
      });
    });

    it('should include reviewer and skill information', async () => {
      const { review, reviewer, skill } = await createTestReview();

      const result = await reviewService.getUserReviews(review.reviewed_id);

      expect(result.reviews[0]).toMatchObject({
        reviewer_username: reviewer.username,
        skill_title: skill.title
      });
    });
  });
}); 