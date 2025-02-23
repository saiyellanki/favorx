const request = require('supertest');
const app = require('../../api/server');
const { testUtils } = require('../helpers/testUtils');
const { testSkills } = require('../fixtures/skills');
const { pool } = require('../../db');

describe('Skills Routes', () => {
  let authToken;
  let userId;
  let skillId;

  const testUser = {
    username: 'skillstester',
    email: 'skills@test.com',
    password: 'TestPassword123'
  };

  beforeEach(async () => {
    const { token, user } = await testUtils.createTestUser(testUser);
    authToken = token;
    userId = user.id;

    // Set user location
    await pool.query(
      'UPDATE profiles SET latitude = $1, longitude = $2 WHERE user_id = $3',
      [51.5074, -0.1278, userId] // London coordinates
    );
  });

  afterEach(async () => {
    await testUtils.cleanupTestUser(testUser.email);
  });

  describe('POST /api/skills', () => {
    it('should create a new skill successfully', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testSkills.offering);

      expect(response.status).toBe(201);
      expect(response.body.skill).toMatchObject({
        category: testSkills.offering.category,
        title: testSkills.offering.title,
        user_id: userId
      });
      skillId = response.body.skill.id;
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/skills')
        .send(testSkills.offering);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/skills', () => {
    beforeEach(async () => {
      // Create test skills
      await testUtils.createTestSkill(userId, testSkills.offering);
      await testUtils.createTestSkill(userId, testSkills.seeking);
    });

    it('should get skills with pagination', async () => {
      const response = await request(app)
        .get('/api/skills')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('skills');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.skills.length).toBeGreaterThan(0);
    });

    it('should filter skills by category', async () => {
      const response = await request(app)
        .get('/api/skills')
        .query({ category: 'Programming' });

      expect(response.status).toBe(200);
      expect(response.body.skills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'Programming' })
        ])
      );
    });

    it('should search skills by text', async () => {
      const response = await request(app)
        .get('/api/skills')
        .query({ search: 'JavaScript' });

      expect(response.status).toBe(200);
      expect(response.body.skills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: expect.stringContaining('JavaScript') })
        ])
      );
    });

    it('should filter by location', async () => {
      const response = await request(app)
        .get('/api/skills')
        .query({ 
          location: 'London',
          distance: 50 // 50km radius
        });

      expect(response.status).toBe(200);
      expect(response.body.skills[0]).toHaveProperty('distance');
    });
  });

  describe('GET /api/skills/matches', () => {
    let otherUser;
    let otherUserToken;

    beforeEach(async () => {
      // Create another user with complementary skills
      const { user, token } = await testUtils.createTestUser({
        username: 'matcher',
        email: 'matcher@test.com',
        password: 'TestPassword123'
      });
      otherUser = user;
      otherUserToken = token;

      // Set other user's location
      await pool.query(
        'UPDATE profiles SET latitude = $1, longitude = $2 WHERE user_id = $3',
        [51.5180, -0.1290, otherUser.id] // Nearby London coordinates
      );

      // Create complementary skills
      await testUtils.createTestSkill(userId, testSkills.offering);
      await testUtils.createTestSkill(otherUser.id, {
        ...testSkills.seeking,
        category: testSkills.offering.category
      });
    });

    afterEach(async () => {
      await testUtils.cleanupTestUser('matcher@test.com');
    });

    it('should find matching skills', async () => {
      const response = await request(app)
        .get('/api/skills/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ max_distance: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matches');
      expect(response.body.matches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: testSkills.offering.category,
            matches: expect.arrayContaining([
              expect.objectContaining({
                is_offering: false
              })
            ])
          })
        ])
      );
    });

    it('should respect distance limits', async () => {
      const response = await request(app)
        .get('/api/skills/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ max_distance: 0.1 }); // Very small radius

      expect(response.status).toBe(200);
      expect(response.body.matches).toHaveLength(0);
    });

    it('should require user location', async () => {
      // Remove user location
      await pool.query(
        'UPDATE profiles SET latitude = NULL, longitude = NULL WHERE user_id = $1',
        [userId]
      );

      const response = await request(app)
        .get('/api/skills/matches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'User location not set');
    });
  });
}); 