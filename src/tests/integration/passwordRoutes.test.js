const request = require('supertest');
const app = require('../../api/server');
const { createTestUser, getAuthToken } = require('../helpers/userHelpers');
const passwordSecurityService = require('../../services/passwordSecurityService');

describe('Password Routes', () => {
  let testUser;
  let authToken;

  beforeEach(async () => {
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
  });

  describe('POST /api/auth/change-password', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass123!',
          confirmPassword: 'NewPass123!'
        });

      expect(response.status).toBe(401);
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'OldPass123!',
          newPassword: 'weak',
          confirmPassword: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Password too short/);
    });

    it('should require password confirmation', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass123!',
          confirmPassword: 'DifferentPass123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Passwords do not match');
    });

    it('should prevent password reuse', async () => {
      // First change password
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewPass123!',
          confirmPassword: 'NewPass123!'
        });

      // Try to reuse old password
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'NewPass123!',
          newPassword: testUser.password,
          confirmPassword: testUser.password
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password was used recently');
    });

    it('should successfully change password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewSecurePass123!',
          confirmPassword: 'NewSecurePass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password updated successfully');

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'NewSecurePass123!'
        });

      expect(loginResponse.status).toBe(200);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should generate reset token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: testUser.email
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/reset instructions sent/i);
    });

    it('should verify reset token', async () => {
      const token = await passwordSecurityService.generateResetToken(testUser.id);

      const response = await request(app)
        .post('/api/auth/reset-password/verify')
        .send({
          token,
          newPassword: 'NewSecurePass123!',
          confirmPassword: 'NewSecurePass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/password reset successful/i);
    });

    it('should handle invalid reset tokens', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password/verify')
        .send({
          token: 'invalid-token',
          newPassword: 'NewSecurePass123!',
          confirmPassword: 'NewSecurePass123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid or expired/i);
    });
  });
}); 