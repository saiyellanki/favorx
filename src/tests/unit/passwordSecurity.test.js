const passwordSecurityService = require('../../services/passwordSecurityService');
const security = require('../../utils/security');
const { createTestUser } = require('../helpers/userHelpers');
const { pool } = require('../../db');
const redisService = require('../../services/redisService');

describe('Password Security Service', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await createTestUser();
  });

  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordSecurityService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hash length
    });

    it('should verify password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordSecurityService.hashPassword(password);

      const isValid = await passwordSecurityService.verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await passwordSecurityService.verifyPassword('WrongPassword123!', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Password History', () => {
    it('should prevent reuse of recent passwords', async () => {
      const oldPasswords = [
        'OldPassword1!',
        'OldPassword2!',
        'OldPassword3!'
      ];

      // Create password history
      const hashedPasswords = await Promise.all(
        oldPasswords.map(pwd => passwordSecurityService.hashPassword(pwd))
      );

      await pool.query(
        'UPDATE security_settings SET password_history = $1 WHERE user_id = $2',
        [JSON.stringify(hashedPasswords), testUser.id]
      );

      // Try to reuse old password
      await expect(
        passwordSecurityService.checkPasswordHistory(testUser.id, oldPasswords[0])
      ).rejects.toThrow('Password was used recently');

      // New password should work
      await expect(
        passwordSecurityService.checkPasswordHistory(testUser.id, 'NewPassword123!')
      ).resolves.not.toThrow();
    });
  });

  describe('Account Lockout', () => {
    it('should lock account after max failed attempts', async () => {
      const maxAttempts = 3;
      
      // Simulate failed attempts
      for (let i = 0; i < maxAttempts; i++) {
        await passwordSecurityService.handleFailedPasswordAttempt(testUser.id);
      }

      // Verify account is locked
      await expect(
        passwordSecurityService.isAccountLocked(testUser.id)
      ).rejects.toThrow('Account is locked');

      // Check lockout duration
      const { rows } = await pool.query(
        'SELECT lockout_until FROM security_settings WHERE user_id = $1',
        [testUser.id]
      );
      expect(rows[0].lockout_until).toBeDefined();
    });

    it('should reset failed attempts', async () => {
      // Create failed attempts
      await passwordSecurityService.handleFailedPasswordAttempt(testUser.id);
      
      // Reset attempts
      await passwordSecurityService.resetFailedAttempts(testUser.id);

      const { rows } = await pool.query(
        'SELECT failed_login_attempts FROM security_settings WHERE user_id = $1',
        [testUser.id]
      );
      expect(rows[0].failed_login_attempts).toBe(0);
    });
  });

  describe('Password Reset', () => {
    it('should generate and verify reset tokens', async () => {
      const token = await passwordSecurityService.generateResetToken(testUser.id);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes in hex

      const userId = await passwordSecurityService.verifyResetToken(token);
      expect(userId).toBe(testUser.id);
    });

    it('should expire reset tokens', async () => {
      const token = await passwordSecurityService.generateResetToken(testUser.id);
      
      // Simulate token expiration
      await redisService.del(`pwd_reset:${security.hashData(token)}`);

      await expect(
        passwordSecurityService.verifyResetToken(token)
      ).rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('Password Validation', () => {
    it('should validate password strength', () => {
      const validation = security.validatePasswordStrength('weak');
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Password too short');

      const strongValidation = security.validatePasswordStrength('StrongP@ssw0rd');
      expect(strongValidation.isValid).toBe(true);
      expect(strongValidation.errors).toHaveLength(0);
    });

    it('should check all password requirements', () => {
      const testCases = [
        {
          password: 'short',
          expectedErrors: ['Password too short']
        },
        {
          password: 'nouppercase123!',
          expectedErrors: ['Missing uppercase letter']
        },
        {
          password: 'NOLOWERCASE123!',
          expectedErrors: ['Missing lowercase letter']
        },
        {
          password: 'NoNumbers!',
          expectedErrors: ['Missing number']
        },
        {
          password: 'NoSpecial123',
          expectedErrors: ['Missing special character']
        }
      ];

      testCases.forEach(({ password, expectedErrors }) => {
        const validation = security.validatePasswordStrength(password);
        expect(validation.isValid).toBe(false);
        expectedErrors.forEach(error => {
          expect(validation.errors).toContain(error);
        });
      });
    });
  });
}); 