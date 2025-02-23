const request = require('supertest');
const app = require('../../api/server');
const { testUtils } = require('../helpers/testUtils');

describe('Auth Routes', () => {
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'TestPassword123'
  };

  afterEach(async () => {
    await testUtils.cleanupTestUser(testUser.email);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('username', testUser.username);
      expect(response.body.user).toHaveProperty('email', testUser.email);
    });

    it('should not register user with existing email', async () => {
      await testUtils.createTestUser(testUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'User already exists');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await testUtils.createTestUser(testUser);
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', testUser.email);
    });

    it('should not login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('POST /api/auth/verify-email', () => {
    let verificationToken;
    let userId;

    beforeEach(async () => {
      const { user } = await testUtils.createTestUser(testUser);
      userId = user.id;
      verificationToken = await verificationService.createVerificationToken(userId);
    });

    it('should verify email with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Email verified successfully');

      const userResult = await pool.query('SELECT is_verified FROM users WHERE id = $1', [userId]);
      expect(userResult.rows[0].is_verified).toBe(true);
    });

    it('should not verify with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid or expired verification token');
    });
  });
}); 