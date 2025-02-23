const express = require('express');
const { pool } = require('../../db');
const auth = require('../../middleware/auth');
const validators = require('../../middleware/validators');
const rateLimiter = require('../../middleware/rateLimiter');
const { AppError } = require('../../utils/errorHandler');
const karmaService = require('../../services/karmaService');

const router = express.Router();

/**
 * @swagger
 * /api/ratings:
 *   post:
 *     summary: Create a new rating
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rated_id
 *               - skill_id
 *               - rating
 *             properties:
 *               rated_id:
 *                 type: integer
 *               skill_id:
 *                 type: integer
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               review:
 *                 type: string
 *                 maxLength: 500
 */
router.post('/',
  auth.requireAuth,
  rateLimiter.ratingCreate,
  validators.ratingValidation,
  validators.validate,
  async (req, res, next) => {
    try {
      const { rated_id, skill_id, rating, review } = req.body;
      const rater_id = req.user.id;

      // Check if user is rating themselves
      if (rated_id === rater_id) {
        throw new AppError('Cannot rate yourself', 400);
      }

      // Check if skill exists and belongs to rated user
      const skillCheck = await pool.query(
        'SELECT id FROM skills WHERE id = $1 AND user_id = $2',
        [skill_id, rated_id]
      );

      if (skillCheck.rows.length === 0) {
        throw new AppError('Invalid skill or user combination', 404);
      }

      // Check if already rated
      const existingRating = await pool.query(
        'SELECT id FROM ratings WHERE rater_id = $1 AND rated_id = $2 AND skill_id = $3',
        [rater_id, rated_id, skill_id]
      );

      if (existingRating.rows.length > 0) {
        throw new AppError('You have already rated this skill', 400);
      }

      // Create rating
      const result = await pool.query(
        `INSERT INTO ratings (rater_id, rated_id, skill_id, rating, review)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [rater_id, rated_id, skill_id, rating, review]
      );

      // Calculate and update karma score
      const newKarmaScore = await karmaService.updateUserKarma(rated_id);

      res.status(201).json({
        message: 'Rating created successfully',
        rating: result.rows[0],
        newKarmaScore
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/ratings/{userId}:
 *   get:
 *     summary: Get ratings for a user
 *     tags: [Ratings]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 */
router.get('/:userId',
  async (req, res, next) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const [ratingsResult, countResult] = await Promise.all([
        pool.query(
          `SELECT r.*, 
                  u.username as rater_username,
                  s.title as skill_title
           FROM ratings r
           JOIN users u ON u.id = r.rater_id
           JOIN skills s ON s.id = r.skill_id
           WHERE r.rated_id = $1
           ORDER BY r.created_at DESC
           LIMIT $2 OFFSET $3`,
          [req.params.userId, limit, offset]
        ),
        pool.query(
          'SELECT COUNT(*) FROM ratings WHERE rated_id = $1',
          [req.params.userId]
        )
      ]);

      const totalItems = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalItems / limit);

      res.json({
        ratings: ratingsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalItems,
          totalPages
        }
      });
    } catch (error) {
      next(error);
    }
});

module.exports = router; 