const { pool } = require('../../db');
const { createTestUser } = require('./userHelpers');
const { createTestSkill } = require('./skillHelpers');

const reviewHelpers = {
  /**
   * Create a test review
   */
  async createTestReview(overrides = {}) {
    const reviewer = await createTestUser({ username: 'test_reviewer' });
    const reviewed = await createTestUser({ username: 'test_reviewed' });
    const skill = await createTestSkill({ user_id: reviewed.id });

    const reviewData = {
      reviewer_id: reviewer.id,
      reviewed_id: reviewed.id,
      skill_id: skill.id,
      title: 'Test Review Title',
      content: 'This is a test review content.',
      is_verified: false,
      ...overrides
    };

    const result = await pool.query(
      `INSERT INTO reviews 
       (reviewer_id, reviewed_id, skill_id, title, content, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        reviewData.reviewer_id,
        reviewData.reviewed_id,
        reviewData.skill_id,
        reviewData.title,
        reviewData.content,
        reviewData.is_verified
      ]
    );

    return {
      review: result.rows[0],
      reviewer,
      reviewed,
      skill
    };
  },

  /**
   * Clean up test reviews
   */
  async cleanupTestReviews() {
    await pool.query('DELETE FROM reviews WHERE title LIKE \'%Test%\'');
  }
};

module.exports = reviewHelpers; 