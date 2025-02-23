const express = require('express');
const multer = require('multer');
const auth = require('../../middleware/auth');
const validators = require('../../middleware/validators');
const rateLimiter = require('../../middleware/rateLimiter');
const { trustVerificationService, VERIFICATION_TYPES } = require('../../services/trustVerificationService');
const { AppError } = require('../../utils/errorHandler');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/verifications:
 *   post:
 *     summary: Request a new verification
 *     tags: [Verifications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/',
  auth.requireAuth,
  rateLimiter.verificationCreate,
  upload.array('documents', 5),
  validators.verificationValidation,
  validators.validate,
  async (req, res, next) => {
    try {
      const { type, ...data } = req.body;
      
      if (!Object.values(VERIFICATION_TYPES).includes(type)) {
        throw new AppError('Invalid verification type', 400);
      }

      const documents = req.files?.map(file => ({
        type: file.fieldname,
        buffer: file.buffer
      }));

      const verification = await trustVerificationService.requestVerification(
        req.user.id,
        type,
        data,
        documents
      );

      res.status(201).json({
        message: 'Verification request submitted successfully',
        verification
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/verifications/{userId}:
 *   get:
 *     summary: Get verifications for a user
 *     tags: [Verifications]
 */
router.get('/:userId',
  auth.requireAuth,
  async (req, res, next) => {
    try {
      const verifications = await trustVerificationService.getUserVerifications(
        req.params.userId
      );

      res.json({ verifications });
    } catch (error) {
      next(error);
    }
});

module.exports = router; 