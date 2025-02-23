const request = require('supertest');
const app = require('../../api/server');
const { testUtils } = require('../helpers/testUtils');
const path = require('path');

describe('Profile Routes', () => {
  let authToken;
  let userId;

  const testUser = {
    username: 'profiletest',
    email: 'profile@test.com',
    password: 'TestPassword123'
  };

  beforeEach(async () => {
    const { token, user } = await testUtils.createTestUser(testUser);
    authToken = token;
    userId = user.id;
  });

  afterEach(async () => {
    await testUtils.cleanupTestUser(testUser.email);
  });

  describe('GET /api/profile', () => {
    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user_id', userId);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/profile');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/profile', () => {
    const updateData = {
      full_name: 'Test User',
      bio: 'Test bio',
      location: 'Test City'
    };

    it('should update profile successfully', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.profile).toMatchObject(updateData);
    });

    it('should validate profile data', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          full_name: 'a', // too short
          bio: 'x'.repeat(501) // too long
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/profile/image', () => {
    it('should upload profile image', async () => {
      const response = await request(app)
        .post('/api/profile/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', path.join(__dirname, '../fixtures/test-image.jpg'));

      expect(response.status).toBe(200);
      expect(response.body.profile).toHaveProperty('profile_image_url');
    });

    it('should validate image file', async () => {
      const response = await request(app)
        .post('/api/profile/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', path.join(__dirname, '../fixtures/invalid-file.txt'));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
}); 