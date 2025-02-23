const request = require('supertest');
const app = require('../../api/server');
const { createTestUser, getAuthToken } = require('../helpers/userHelpers');
const { createTestSkill } = require('../helpers/skillHelpers');
const { createTestRating } = require('../helpers/ratingHelpers');

describe('Rating Routes', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
  });

  describe('POST /api/ratings', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/ratings')
        .send({
          rated_id: 1,
          skill_id: 1,
          rating: 5
        });

      expect(response.status).toBe(401);
    });

    it('should validate rating input', async () => {
      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rated_id: 1,
          skill_id: 1,
          rating: 6 // Invalid rating
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should prevent self-rating', async () => {
      const skill = await createTestSkill({ user_id: testUser.id });

      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rated_id: testUser.id,
          skill_id: skill.id,
          rating: 5
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot rate yourself');
    });

    it('should prevent duplicate ratings', async () => {
      const ratedUser = await createTestUser();
      const skill = await createTestSkill({ user_id: ratedUser.id });

      // Create first rating
      await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rated_id: ratedUser.id,
          skill_id: skill.id,
          rating: 5
        });

      // Try to create duplicate rating
      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rated_id: ratedUser.id,
          skill_id: skill.id,
          rating: 4
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('You have already rated this skill');
    });

    it('should update karma score after rating', async () => {
      const ratedUser = await createTestUser();
      const skill = await createTestSkill({ user_id: ratedUser.id });

      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rated_id: ratedUser.id,
          skill_id: skill.id,
          rating: 5,
          review: 'Excellent service!'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('newKarmaScore');
      expect(typeof response.body.newKarmaScore).toBe('number');
    });
  });

  describe('GET /api/ratings/:userId', () => {
    it('should return paginated ratings', async () => {
      const user = await createTestUser();
      
      // Create multiple ratings
      await Promise.all(Array(15).fill().map(() =>
        createTestRating({ rated_id: user.id })
      ));

      const response = await request(app)
        .get(`/api/ratings/${user.id}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.ratings).toHaveLength(10);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        totalItems: 15,
        totalPages: 2
      });
    });

    it('should include rating metadata', async () => {
      const user = await createTestUser();
      const { rating } = await createTestRating({ rated_id: user.id });

      const response = await request(app)
        .get(`/api/ratings/${user.id}`);

      expect(response.status).toBe(200);
      expect(response.body.ratings[0]).toMatchObject({
        id: rating.id,
        rating: rating.rating,
        review: rating.review,
        created_at: expect.any(String)
      });
    });
  });
}); 