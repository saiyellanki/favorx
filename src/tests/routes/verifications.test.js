const request = require('supertest');
const path = require('path');
const app = require('../../api/server');
const { pool } = require('../../db');
const { createTestUser, getAuthToken } = require('../helpers/userHelpers');
const { 
  createTestVerification, 
  cleanupTestVerifications 
} = require('../helpers/verificationHelpers');
const { VERIFICATION_TYPES } = require('../../services/trustVerificationService');

describe('Verification Routes', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
  });

  afterAll(async () => {
    await cleanupTestVerifications();
    await pool.end();
  });

  describe('POST /api/verifications', () => {
    it('should create a new verification request', async () => {
      const response = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${authToken}`)
        .field('type', VERIFICATION_TYPES.ID)
        .field('full_name', 'Test User')
        .field('id_number', 'TEST123456')
        .attach('id_front', path.join(__dirname, '../fixtures/test-id-front.jpg'))
        .attach('id_back', path.join(__dirname, '../fixtures/test-id-back.jpg'));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Verification request submitted successfully');
      expect(response.body.verification).toMatchObject({
        type: VERIFICATION_TYPES.ID,
        status: 'pending'
      });
    });

    it('should prevent duplicate pending verifications', async () => {
      await createTestVerification({ user_id: testUser.id, type: VERIFICATION_TYPES.ID });

      const response = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${authToken}`)
        .field('type', VERIFICATION_TYPES.ID)
        .field('full_name', 'Test User')
        .attach('id_front', path.join(__dirname, '../fixtures/test-id-front.jpg'));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'A verification request is already pending');
    });

    it('should validate verification type', async () => {
      const response = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${authToken}`)
        .field('type', 'invalid_type')
        .field('full_name', 'Test User');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid verification type');
    });

    it('should validate required fields based on type', async () => {
      const response = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${authToken}`)
        .field('type', VERIFICATION_TYPES.ID);

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Full name is required for ID verification'
        })
      );
    });
  });

  describe('GET /api/verifications/:userId', () => {
    it('should get user verifications with documents', async () => {
      const { verification, user } = await createTestVerification();
      await Promise.all([
        createTestDocument(verification.id, 'id_front'),
        createTestDocument(verification.id, 'id_back')
      ]);

      const response = await request(app)
        .get(`/api/verifications/${user.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.verifications).toHaveLength(1);
      expect(response.body.verifications[0].documents).toHaveLength(2);
    });

    it('should return empty array for user with no verifications', async () => {
      const newUser = await createTestUser({ username: 'no_verifications_user' });

      const response = await request(app)
        .get(`/api/verifications/${newUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.verifications).toHaveLength(0);
    });
  });
}); 