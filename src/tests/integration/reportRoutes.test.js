const request = require('supertest');
const app = require('../../api/server');
const { createTestUser, getAuthToken } = require('../helpers/userHelpers');
const { createTestSkill } = require('../helpers/skillHelpers');
const { createTestReport } = require('../helpers/reportHelpers');
const { REPORT_TYPES, REPORT_REASONS } = require('../../services/reportingService');

describe('Report Routes', () => {
  let testUser;
  let authToken;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
    adminUser = await createTestUser({ is_admin: true });
    adminToken = await getAuthToken(adminUser);
  });

  describe('POST /api/reports', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/reports')
        .send({
          reported_id: 1,
          type: REPORT_TYPES.USER,
          target_id: 1,
          reason: REPORT_REASONS.INAPPROPRIATE
        });

      expect(response.status).toBe(401);
    });

    it('should create a new report', async () => {
      const reported = await createTestUser();
      const skill = await createTestSkill({ user_id: reported.id });

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reported_id: reported.id,
          type: REPORT_TYPES.SKILL,
          target_id: skill.id,
          reason: REPORT_REASONS.INAPPROPRIATE,
          description: 'Test report'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Report submitted successfully');
    });

    it('should validate report input', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reported_id: 1,
          type: 'invalid_type',
          target_id: 1,
          reason: 'invalid_reason'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/reports/moderate/:reportId', () => {
    it('should require admin privileges', async () => {
      const { report } = await createTestReport();

      const response = await request(app)
        .post(`/api/reports/moderate/${report.id}`)
        .set('Authorization', `Bearer ${authToken}`) // Non-admin token
        .send({
          action: 'warning',
          reason: 'Test moderation'
        });

      expect(response.status).toBe(403);
    });

    it('should moderate a report', async () => {
      const { report } = await createTestReport();

      const response = await request(app)
        .post(`/api/reports/moderate/${report.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'warning',
          reason: 'Test moderation'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Moderation action applied successfully');
    });
  });

  describe('GET /api/reports', () => {
    it('should require admin privileges', async () => {
      const response = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });

    it('should return paginated reports', async () => {
      // Create multiple reports
      await Promise.all(Array(15).fill().map(() => createTestReport()));

      const response = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status: 'pending', page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.reports).toHaveLength(10);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        totalItems: 15,
        totalPages: 2
      });
    });
  });
}); 