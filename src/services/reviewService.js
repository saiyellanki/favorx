const { pool } = require('../db');
const { AppError } = require('../utils/errorHandler');
const karmaService = require('./karmaService');

const reviewService = {
  /**
   * Create a new review
   */
  async createReview(reviewerId, reviewedId, skillId, title, content) {
    // Check if already reviewed
    const existingReview = await pool.query(
      'SELECT id FROM reviews WHERE reviewer_id = $1 AND reviewed_id = $2 AND skill_id = $3',
      [reviewerId, reviewedId, skillId]
    );

    if (existingReview.rows.length > 0) {
      throw new AppError('You have already reviewed this skill', 400);
    }

    // Check if skill exists and belongs to reviewed user
    const skillCheck = await pool.query(
      'SELECT id FROM skills WHERE id = $1 AND user_id = $2',
      [skillId, reviewedId]
    );

    if (skillCheck.rows.length === 0) {
      throw new AppError('Invalid skill or user combination', 404);
    }

    // Create review
    const result = await pool.query(
      `INSERT INTO reviews 
       (reviewer_id, reviewed_id, skill_id, title, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [reviewerId, reviewedId, skillId, title, content]
    );

    // Update karma score since reviews affect activity
    await karmaService.updateUserKarma(reviewedId);

    return result.rows[0];
  },

  /**
   * Get reviews for a user with pagination
   */
  async getUserReviews(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [reviewsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT r.*,
                u.username as reviewer_username,
                s.title as skill_title,
                s.category as skill_category
         FROM reviews r
         JOIN users u ON u.id = r.reviewer_id
         JOIN skills s ON s.id = r.skill_id
         WHERE r.reviewed_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query(
        'SELECT COUNT(*) FROM reviews WHERE reviewed_id = $1',
        [userId]
      )
    ]);

    return {
      reviews: reviewsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    };
  },

  /**
   * Verify a review (e.g., after successful transaction)
   */
  async verifyReview(reviewId) {
    const result = await pool.query(
      `UPDATE reviews 
       SET is_verified = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [reviewId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Review not found', 404);
    }

    return result.rows[0];
  }
};

module.exports = reviewService; 