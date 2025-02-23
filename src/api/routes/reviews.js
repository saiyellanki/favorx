const express = require('express');
const auth = require('../../middleware/auth');
const validators = require('../../middleware/validators');
const rateLimiter = require('../../middleware/rateLimiter');
const reviewService = require('../../services/reviewService');
const { AppError } = require('../../utils/errorHandler');

const router = express.Router();

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reviewed_id
 *               - skill_id
 *               - title
 *               - content
 */
router.post('/',
  auth.requireAuth,
  rateLimiter.reviewCreate,
  validators.reviewValidation,
  validators.validate,
  async (req, res, next) => {
    try {
      const { reviewed_id, skill_id, title, content } = req.body;
      const reviewer_id = req.user.id;

      if (reviewed_id === reviewer_id) {
        throw new AppError('Cannot review yourself', 400);
      }

      const review = await reviewService.createReview(
        reviewer_id,
        reviewed_id,
        skill_id,
        title,
        content
      );

      res.status(201).json({
        message: 'Review created successfully',
        review
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/reviews/{userId}:
 *   get:
 *     summary: Get reviews for a user
 *     tags: [Reviews]
 */
router.get('/:userId',
  async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const result = await reviewService.getUserReviews(
        req.params.userId,
        page,
        limit
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
});

module.exports = router; 