const request = require('supertest');
const app = require('../../api/server');
const { pool } = require('../../db');
const { createTestUser, getAuthToken } = require('../helpers/userHelpers');
const { createTestSkill } = require('../helpers/skillHelpers');
const { createTestReview, cleanupTestReviews } = require('../helpers/reviewHelpers');

describe('Review Routes', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
  });

  afterAll(async () => {
    await cleanupTestReviews();
    await pool.end();
  });

  describe('POST /api/reviews', () => {
    it('should create a new review', async () => {
      const reviewed = await createTestUser({ username: 'reviewed_user' });
      const skill = await createTestSkill({ user_id: reviewed.id });

      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reviewed_id: reviewed.id,
          skill_id: skill.id,
          title: 'Great Experience',
          content: 'Very professional and skilled. Would recommend!'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Review created successfully');
      expect(response.body.review).toMatchObject({
        title: 'Great Experience',
        content: 'Very professional and skilled. Would recommend!'
      });
    });

    it('should prevent self-review', async () => {
      const skill = await createTestSkill({ user_id: testUser.id });

      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reviewed_id: testUser.id,
          skill_id: skill.id,
          title: 'Invalid Review',
          content: 'Should not work'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Cannot review yourself');
    });

    it('should prevent duplicate reviews', async () => {
      const { reviewed, skill } = await createTestReview({ reviewer_id: testUser.id });

      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reviewed_id: reviewed.id,
          skill_id: skill.id,
          title: 'Duplicate Review',
          content: 'Should not work'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'You have already reviewed this skill');
    });

    it('should validate review input', async () => {
      const reviewed = await createTestUser({ username: 'reviewed_user2' });
      const skill = await createTestSkill({ user_id: reviewed.id });

      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reviewed_id: reviewed.id,
          skill_id: skill.id,
          title: '', // Invalid title
          content: 'x' // Invalid content (too short)
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Title must be between 3 and 100 characters'
          }),
          expect.objectContaining({
            msg: 'Content must be between 10 and 1000 characters'
          })
        ])
      );
    });
  });

  describe('GET /api/reviews/:userId', () => {
    it('should get user reviews with pagination', async () => {
      const reviewed = await createTestUser({ username: 'reviewed_user3' });
      await Promise.all([
        createTestReview({ reviewed_id: reviewed.id }),
        createTestReview({ reviewed_id: reviewed.id }),
        createTestReview({ reviewed_id: reviewed.id })
      ]);

      const response = await request(app)
        .get(`/api/reviews/${reviewed.id}`)
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.reviews).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        totalItems: 3,
        totalPages: 2
      });
    });

    it('should return empty array for user with no reviews', async () => {
      const newUser = await createTestUser({ username: 'no_reviews_user' });

      const response = await request(app)
        .get(`/api/reviews/${newUser.id}`);

      expect(response.status).toBe(200);
      expect(response.body.reviews).toHaveLength(0);
      expect(response.body.pagination.totalItems).toBe(0);
    });

    it('should include reviewer and skill information', async () => {
      const { reviewed, reviewer, skill, review } = await createTestReview();

      const response = await request(app)
        .get(`/api/reviews/${reviewed.id}`);

      expect(response.status).toBe(200);
      expect(response.body.reviews[0]).toMatchObject({
        reviewer_username: reviewer.username,
        skill_title: skill.title,
        title: review.title,
        content: review.content
      });
    });
  });
}); 