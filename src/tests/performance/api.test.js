const request = require('supertest');
const app = require('../../api/server');
const { createTestUser } = require('../helpers/userHelpers');
const { createTestSkill } = require('../helpers/skillHelpers');

describe('API Performance', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
  });

  describe('Search Performance', () => {
    beforeEach(async () => {
      // Create 100 test skills
      const promises = Array(100).fill().map((_, i) => 
        createTestSkill({
          title: `Test Skill ${i}`,
          description: `Test description ${i}`
        })
      );
      await Promise.all(promises);
    });

    it('should handle search requests within 200ms', async () => {
      const start = Date.now();
      
      const response = await request(app)
        .get('/api/skills/search')
        .query({ q: 'Test' });

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200);
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = Array(concurrentRequests).fill().map(() =>
        request(app)
          .get('/api/skills/search')
          .query({ q: 'Test' })
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(11).fill().map(() =>
        request(app)
          .get('/api/skills')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
}); 