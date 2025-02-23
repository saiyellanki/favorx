const request = require('supertest');
const app = require('../../api/server');
const { generateTestData, generateTestToken } = require('../utils/testUtils');
const { createTestUser } = require('../helpers/userHelpers');
const { createTestSkill } = require('../helpers/skillHelpers');

describe('User Flow', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = generateTestToken(testUser.id);
  });

  describe('Complete User Journey', () => {
    it('should complete a full user interaction flow', async () => {
      // 1. Register new user
      const userData = generateTestData().user;
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body).toHaveProperty('token');

      const userToken = registerResponse.body.token;

      // 2. Create profile
      const profileData = generateTestData().profile;
      const profileResponse = await request(app)
        .post('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(profileData);

      expect(profileResponse.status).toBe(201);
      expect(profileResponse.body.profile).toMatchObject(profileData);

      // 3. Create skill
      const skillData = generateTestData().skill;
      const skillResponse = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${userToken}`)
        .send(skillData);

      expect(skillResponse.status).toBe(201);
      expect(skillResponse.body.skill).toMatchObject(skillData);

      // 4. Search for skills
      const searchResponse = await request(app)
        .get('/api/skills/search')
        .query({ q: skillData.title });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.skills).toHaveLength(1);
      expect(searchResponse.body.skills[0]).toMatchObject(skillData);

      // 5. Rate and review
      const ratingResponse = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rated_id: registerResponse.body.user.id,
          skill_id: skillResponse.body.skill.id,
          rating: 5,
          review: 'Excellent service!'
        });

      expect(ratingResponse.status).toBe(201);
      expect(ratingResponse.body).toHaveProperty('newKarmaScore');

      // 6. Report inappropriate content
      const reportResponse = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reported_id: registerResponse.body.user.id,
          type: 'skill',
          target_id: skillResponse.body.skill.id,
          reason: 'inappropriate',
          description: 'Test report'
        });

      expect(reportResponse.status).toBe(201);
    });
  });
}); 