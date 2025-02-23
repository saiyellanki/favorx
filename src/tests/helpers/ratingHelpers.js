const { pool } = require('../../db');
const { createTestUser } = require('./userHelpers');
const { createTestSkill } = require('./skillHelpers');

const ratingHelpers = {
  /**
   * Create a test rating
   */
  async createTestRating(overrides = {}) {
    const rater = await createTestUser({ username: 'test_rater' });
    const rated = await createTestUser({ username: 'test_rated' });
    const skill = await createTestSkill({ user_id: rated.id });

    const ratingData = {
      rater_id: rater.id,
      rated_id: rated.id,
      skill_id: skill.id,
      rating: 4,
      review: 'Great service!',
      ...overrides
    };

    const result = await pool.query(
      `INSERT INTO ratings 
       (rater_id, rated_id, skill_id, rating, review)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        ratingData.rater_id,
        ratingData.rated_id,
        ratingData.skill_id,
        ratingData.rating,
        ratingData.review
      ]
    );

    return {
      rating: result.rows[0],
      rater,
      rated,
      skill
    };
  },

  /**
   * Clean up test ratings
   */
  async cleanupTestRatings() {
    await pool.query('DELETE FROM ratings WHERE review LIKE \'%test%\'');
  }
};

module.exports = ratingHelpers; 