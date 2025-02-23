const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../../db');
const validators = require('../../middleware/validators');
const { AppError } = require('../../utils/errorHandler');
const verificationService = require('../../services/verificationService');
const { sendVerificationEmail } = require('../../utils/emailService');
const auth = require('../../middleware/auth');
const passwordValidation = require('../../middleware/passwordValidation');
const deviceAuth = require('../../middleware/deviceAuth');

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post('/register',
  passwordValidation.validateStrength,
  passwordValidation.requireConfirmation,
  validators.registerValidation,
  validators.validate,
  async (req, res, next) => {
    try {
      const { username, email, password } = req.body;
      
      const userExists = await pool.query(
        'SELECT * FROM users WHERE email = $1 OR username = $2',
        [email, username]
      );

      if (userExists.rows.length > 0) {
        throw new AppError('User already exists', 400);
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
        [username, email, passwordHash]
      );

      await pool.query(
        'INSERT INTO profiles (user_id) VALUES ($1)',
        [result.rows[0].id]
      );

      const token = jwt.sign(
        { id: result.rows[0].id, username },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: result.rows[0].id,
          username: result.rows[0].username,
          email: result.rows[0].email
        }
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post('/login',
  passwordValidation.checkLockout,
  validators.loginValidation,
  validators.validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        throw new AppError('Invalid credentials', 401);
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!validPassword) {
        throw new AppError('Invalid credentials', 401);
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify email with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;
    await verificationService.verifyEmail(token);
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Email already verified
 */
router.post('/resend-verification', 
  auth.requireAuth,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        'SELECT is_verified, email FROM users WHERE id = $1',
        [req.user.id]
      );

      if (result.rows[0].is_verified) {
        throw new AppError('Email already verified', 400);
      }

      const token = await verificationService.createVerificationToken(req.user.id);
      await sendVerificationEmail(result.rows[0].email, token);

      res.json({ message: 'Verification email sent' });
    } catch (error) {
      next(error);
    }
});

router.post('/change-password',
  auth.requireAuth,
  deviceAuth.requireTrustedDevice,
  passwordValidation.validateStrength,
  passwordValidation.checkHistory,
  passwordValidation.requireConfirmation,
  async (req, res, next) => {
    // ... existing code ...
  }
);

module.exports = router; 