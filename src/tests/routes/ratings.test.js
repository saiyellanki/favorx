const request = require('supertest');
const app = require('../../api/server');
const { pool } = require('../../db');
const { createTestUser, getAuthToken } = require('../helpers/userHelpers');
const { createTestSkill } = require('../helpers/skillHelpers');
const { createTestRating, cleanupTestRatings } = require('../helpers/ratingHelpers');

describe('Rating Routes', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
  });

  afterAll(async () => {
    await cleanupTestRatings();
    await pool.end();
  });

  describe('POST /api/ratings', () => {
    it('should create a new rating', async () => {
      const rated = await createTestUser({ username: 'rated_user' });
      const skill = await createTestSkill({ user_id: rated.id });

      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rated_id: rated.id,
          skill_id: skill.id,
          rating: 5,
          review: 'Excellent service!'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Rating created successfully');
      expect(response.body.rating).toHaveProperty('rating', 5);
      expect(response.body).toHaveProperty('newKarmaScore');
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
      expect(response.body).toHaveProperty('error', 'Cannot rate yourself');
    });

    it('should prevent duplicate ratings', async () => {
      const { rated, skill } = await createTestRating({ rater_id: testUser.id });

      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rated_id: rated.id,
          skill_id: skill.id,
          rating: 4
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'You have already rated this skill');
    });

    it('should validate rating input', async () => {
      const rated = await createTestUser({ username: 'rated_user2' });
      const skill = await createTestSkill({ user_id: rated.id });

      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rated_id: rated.id,
          skill_id: skill.id,
          rating: 6 // Invalid rating
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Rating must be between 1 and 5'
        })
      );
    });
  });

  describe('GET /api/ratings/:userId', () => {
    it('should get user ratings with pagination', async () => {
      const rated = await createTestUser({ username: 'rated_user3' });
      await Promise.all([
        createTestRating({ rated_id: rated.id }),
        createTestRating({ rated_id: rated.id }),
        createTestRating({ rated_id: rated.id })
      ]);

      const response = await request(app)
        .get(`/api/ratings/${rated.id}`)
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.ratings).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        totalItems: 3,
        totalPages: 2
      });
    });

    it('should return empty array for user with no ratings', async () => {
      const newUser = await createTestUser({ username: 'no_ratings_user' });

      const response = await request(app)
        .get(`/api/ratings/${newUser.id}`);

      expect(response.status).toBe(200);
      expect(response.body.ratings).toHaveLength(0);
      expect(response.body.pagination.totalItems).toBe(0);
    });
  });
}); 