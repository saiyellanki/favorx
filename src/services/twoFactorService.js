const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { AppError } = require('../utils/errorHandler');
const redisService = require('./redisService');
const securityAuditService = require('./securityAuditService');

const twoFactorService = {
  /**
   * Generate new 2FA secret
   */
  async generateSecret(userId) {
    const secret = speakeasy.generateSecret({
      name: `FavorX:${userId}`,
      issuer: 'FavorX'
    });

    // Store secret temporarily until verified
    await redisService.setex(
      `2fa:setup:${userId}`,
      300, // 5 minutes expiry
      secret.base32
    );

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode
    };
  },

  /**
   * Verify and enable 2FA
   */
  async verifyAndEnable(userId, token) {
    const secret = await redisService.get(`2fa:setup:${userId}`);
    if (!secret) {
      throw new AppError('2FA setup expired. Please start over.', 400);
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1 // Allow 30 seconds clock skew
    });

    if (!verified) {
      throw new AppError('Invalid verification code', 400);
    }

    // Store verified secret in database
    await pool.query(
      'UPDATE security_settings SET two_factor_enabled = TRUE, two_factor_secret = $1 WHERE user_id = $2',
      [secret, userId]
    );

    // Clean up temporary secret
    await redisService.del(`2fa:setup:${userId}`);

    // Log security event
    await securityAuditService.logSecurityEvent('2fa_enabled', { userId });

    return true;
  },

  /**
   * Verify 2FA token
   */
  async verifyToken(userId, token) {
    const { rows } = await pool.query(
      'SELECT two_factor_secret FROM security_settings WHERE user_id = $1 AND two_factor_enabled = TRUE',
      [userId]
    );

    if (!rows.length) {
      throw new AppError('2FA not enabled for this user', 400);
    }

    const verified = speakeasy.totp.verify({
      secret: rows[0].two_factor_secret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      // Log failed attempt
      await securityAuditService.logSecurityEvent('2fa_failed', { userId });
      throw new AppError('Invalid 2FA code', 401);
    }

    return true;
  },

  /**
   * Generate backup codes
   */
  async generateBackupCodes(userId) {
    const codes = Array(8).fill(null).map(() => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Store hashed backup codes
    const hashedCodes = codes.map(code => security.hashData(code));
    await pool.query(
      'UPDATE security_settings SET backup_codes = $1 WHERE user_id = $2',
      [JSON.stringify(hashedCodes), userId]
    );

    return codes;
  },

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId, code) {
    const { rows } = await pool.query(
      'SELECT backup_codes FROM security_settings WHERE user_id = $1',
      [userId]
    );

    if (!rows.length) {
      throw new AppError('No backup codes found', 400);
    }

    const hashedCode = security.hashData(code);
    const backupCodes = JSON.parse(rows[0].backup_codes);
    const index = backupCodes.indexOf(hashedCode);

    if (index === -1) {
      await securityAuditService.logSecurityEvent('backup_code_failed', { userId });
      throw new AppError('Invalid backup code', 401);
    }

    // Remove used backup code
    backupCodes.splice(index, 1);
    await pool.query(
      'UPDATE security_settings SET backup_codes = $1 WHERE user_id = $2',
      [JSON.stringify(backupCodes), userId]
    );

    await securityAuditService.logSecurityEvent('backup_code_used', { userId });
    return true;
  }
};

module.exports = twoFactorService; 