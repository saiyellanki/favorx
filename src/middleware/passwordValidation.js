const passwordSecurityService = require('../services/passwordSecurityService');
const { AppError } = require('../utils/errorHandler');
const security = require('../utils/security');

const passwordValidation = {
  /**
   * Validate password strength
   */
  validateStrength: async (req, res, next) => {
    try {
      const { password } = req.body;
      const validation = security.validatePasswordStrength(password);

      if (!validation.isValid) {
        throw new AppError(`Invalid password: ${validation.errors.join(', ')}`, 400);
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  /**
   * Check password history
   */
  checkHistory: async (req, res, next) => {
    try {
      const { password } = req.body;
      await passwordSecurityService.checkPasswordHistory(req.user.id, password);
      next();
    } catch (error) {
      next(error);
    }
  },

  /**
   * Check account lockout
   */
  checkLockout: async (req, res, next) => {
    try {
      const { email } = req.body;
      const { rows } = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (rows.length) {
        await passwordSecurityService.isAccountLocked(rows[0].id);
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  /**
   * Require password confirmation
   */
  requireConfirmation: async (req, res, next) => {
    try {
      const { password, confirmPassword } = req.body;

      if (password !== confirmPassword) {
        throw new AppError('Passwords do not match', 400);
      }

      next();
    } catch (error) {
      next(error);
    }
  }
};

module.exports = passwordValidation; 