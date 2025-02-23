const express = require('express');
const { pool } = require('../../db');
const auth = require('../../middleware/auth');
const validators = require('../../middleware/validators');
const rateLimiter = require('../../middleware/rateLimiter');
const { AppError } = require('../../utils/errorHandler');
const multer = require('multer');
const { uploadToS3, deleteFromS3 } = require('../../utils/s3');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get user's profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', auth.requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.username, u.email, u.karma_score 
       FROM profiles p 
       JOIN users u ON u.id = p.user_id 
       WHERE p.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Profile not found', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Update user profile information.
 *       Rate limited to 10 updates per hour per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *               bio:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 */
router.put('/', 
  auth.requireAuth,
  rateLimiter.profileUpdate,
  validators.profileValidation,
  validators.validate,
  async (req, res, next) => {
    try {
      const { full_name, bio, location } = req.body;

      const result = await pool.query(
        `UPDATE profiles 
         SET full_name = COALESCE($1, full_name),
             bio = COALESCE($2, bio),
             location = COALESCE($3, location),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4
         RETURNING *`,
        [full_name, bio, location, req.user.id]
      );

      res.json({
        message: 'Profile updated successfully',
        profile: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/profile/{userId}:
 *   get:
 *     summary: Get profile by user ID
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       404:
 *         description: Profile not found
 */
router.get('/:userId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT p.full_name, p.bio, p.location, p.profile_image_url,
              u.username, u.karma_score
       FROM profiles p 
       JOIN users u ON u.id = p.user_id 
       WHERE p.user_id = $1`,
      [req.params.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Profile not found', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/profile/image:
 *   post:
 *     summary: Upload profile image
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Upload a profile image.
 *       Rate limited to 5 uploads per hour per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       400:
 *         description: Invalid file
 *       401:
 *         description: Unauthorized
 */
router.post('/image',
  auth.requireAuth,
  rateLimiter.imageUpload,
  upload.single('image'),
  validators.imageValidation,
  async (req, res, next) => {
    try {
      // Get current profile to delete old image if exists
      const currentProfile = await pool.query(
        'SELECT profile_image_url FROM profiles WHERE user_id = $1',
        [req.user.id]
      );

      // Delete old image from S3 if exists
      if (currentProfile.rows[0]?.profile_image_url) {
        await deleteFromS3(currentProfile.rows[0].profile_image_url);
      }

      // Upload new image to S3
      const imageUrl = await uploadToS3(req.file);

      // Update profile with new image URL
      const result = await pool.query(
        'UPDATE profiles SET profile_image_url = $1 WHERE user_id = $2 RETURNING *',
        [imageUrl, req.user.id]
      );

      res.json({
        message: 'Profile image updated successfully',
        profile: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
});

module.exports = router; 