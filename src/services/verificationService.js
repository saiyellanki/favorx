const crypto = require('crypto');
const { pool } = require('../db');
const { AppError } = require('../utils/errorHandler');
const { sendVerificationEmail } = require('../utils/emailService');

const verificationService = {
  generateToken: () => {
    return crypto.randomBytes(32).toString('hex');
  },

  createVerificationToken: async (userId, type = 'email') => {
    const token = verificationService.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await pool.query(
      'INSERT INTO verification_tokens (user_id, token, type, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, token, type, expiresAt]
    );

    return token;
  },

  verifyEmail: async (token) => {
    const result = await pool.query(
      `SELECT vt.*, u.email 
       FROM verification_tokens vt
       JOIN users u ON u.id = vt.user_id
       WHERE vt.token = $1 AND vt.type = 'email' AND vt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    const { user_id } = result.rows[0];

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update user verification status
      await client.query(
        'UPDATE users SET is_verified = true WHERE id = $1',
        [user_id]
      );

      // Delete used token
      await client.query(
        'DELETE FROM verification_tokens WHERE token = $1',
        [token]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return true;
  },

  // Cleanup expired tokens (can be run periodically)
  cleanupExpiredTokens: async () => {
    await pool.query('DELETE FROM verification_tokens WHERE expires_at < NOW()');
  }
};

module.exports = verificationService; 