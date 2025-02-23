const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { AppError } = require('../utils/errorHandler');
const securityAuditService = require('./securityAuditService');
const redisService = require('./redisService');
const security = require('../utils/security');
const config = require('../config/security');

const passwordSecurityService = {
  /**
   * Hash password
   */
  async hashPassword(password) {
    return bcrypt.hash(password, 12);
  },

  /**
   * Verify password
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  },

  /**
   * Check password history
   */
  async checkPasswordHistory(userId, newPassword) {
    const { rows } = await pool.query(
      'SELECT password_history FROM security_settings WHERE user_id = $1',
      [userId]
    );

    if (rows.length && rows[0].password_history) {
      const history = rows[0].password_history;
      
      // Check against last 5 passwords
      for (const oldHash of history.slice(-5)) {
        if (await this.verifyPassword(newPassword, oldHash)) {
          throw new AppError('Password was used recently', 400);
        }
      }
    }
  },

  /**
   * Update password with security checks
   */
  async updatePassword(userId, currentPassword, newPassword) {
    // Get user's current password hash
    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (!rows.length) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isValid = await this.verifyPassword(currentPassword, rows[0].password_hash);
    if (!isValid) {
      await this.handleFailedPasswordAttempt(userId);
      throw new AppError('Current password is incorrect', 401);
    }

    // Validate new password strength
    const validation = security.validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      throw new AppError(`Invalid password: ${validation.errors.join(', ')}`, 400);
    }

    // Check password history
    await this.checkPasswordHistory(userId, newPassword);

    // Hash new password
    const newHash = await this.hashPassword(newPassword);

    // Update password and history
    await pool.query(`
      WITH updated_user AS (
        UPDATE users 
        SET password_hash = $1 
        WHERE id = $2
      )
      UPDATE security_settings 
      SET 
        password_history = COALESCE(password_history, '[]'::jsonb) || $3::jsonb,
        last_password_change = NOW()
      WHERE user_id = $2
    `, [newHash, userId, JSON.stringify([rows[0].password_hash])]);

    // Log security event
    await securityAuditService.logSecurityEvent('password_changed', { userId });

    // Invalidate all sessions except current
    await sessionService.invalidateOtherSessions(userId, req.session.id);
  },

  /**
   * Handle failed password attempt
   */
  async handleFailedPasswordAttempt(userId) {
    const { rows } = await pool.query(`
      UPDATE security_settings 
      SET failed_login_attempts = failed_login_attempts + 1 
      WHERE user_id = $1 
      RETURNING failed_login_attempts
    `, [userId]);

    const attempts = rows[0]?.failed_login_attempts || 1;

    if (attempts >= config.password.maxAttempts) {
      // Lock account
      await pool.query(`
        UPDATE security_settings 
        SET lockout_until = NOW() + interval '15 minutes' 
        WHERE user_id = $1
      `, [userId]);

      await securityAuditService.logSecurityEvent('account_locked', {
        userId,
        reason: 'Too many failed password attempts'
      });

      throw new AppError('Account locked. Try again later.', 423);
    }
  },

  /**
   * Reset failed attempts
   */
  async resetFailedAttempts(userId) {
    await pool.query(`
      UPDATE security_settings 
      SET 
        failed_login_attempts = 0,
        lockout_until = NULL 
      WHERE user_id = $1
    `, [userId]);
  },

  /**
   * Check if account is locked
   */
  async isAccountLocked(userId) {
    const { rows } = await pool.query(`
      SELECT lockout_until 
      FROM security_settings 
      WHERE user_id = $1 AND lockout_until > NOW()
    `, [userId]);

    if (rows.length) {
      const remainingTime = Math.ceil(
        (new Date(rows[0].lockout_until) - new Date()) / 1000
      );
      throw new AppError('Account is locked', 423, { remainingTime });
    }

    return false;
  },

  /**
   * Generate password reset token
   */
  async generateResetToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = security.hashData(token);

    // Store token with expiry
    await redisService.setex(
      `pwd_reset:${hashedToken}`,
      3600, // 1 hour
      userId.toString()
    );

    return token;
  },

  /**
   * Verify reset token
   */
  async verifyResetToken(token) {
    const hashedToken = security.hashData(token);
    const userId = await redisService.get(`pwd_reset:${hashedToken}`);

    if (!userId) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    return parseInt(userId);
  }
};

module.exports = passwordSecurityService; 