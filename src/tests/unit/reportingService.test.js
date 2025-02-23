const { 
  reportingService,
  REPORT_TYPES,
  REPORT_REASONS,
  MODERATION_ACTIONS 
} = require('../../services/reportingService');
const { createTestUser } = require('../helpers/userHelpers');
const { createTestSkill } = require('../helpers/skillHelpers');
const { createTestReport } = require('../helpers/reportHelpers');
const redisService = require('../../services/redisService');

describe('Reporting Service', () => {
  describe('createReport', () => {
    it('should create a new report', async () => {
      const reporter = await createTestUser();
      const reported = await createTestUser();
      const skill = await createTestSkill({ user_id: reported.id });

      const report = await reportingService.createReport(
        reporter.id,
        reported.id,
        REPORT_TYPES.SKILL,
        skill.id,
        REPORT_REASONS.INAPPROPRIATE,
        'Inappropriate content'
      );

      expect(report).toMatchObject({
        reporter_id: reporter.id,
        reported_id: reported.id,
        type: REPORT_TYPES.SKILL,
        target_id: skill.id,
        reason: REPORT_REASONS.INAPPROPRIATE,
        description: 'Inappropriate content',
        status: 'pending'
      });
    });

    it('should prevent duplicate pending reports', async () => {
      const { reporter, reported, skill } = await createTestReport();

      await expect(
        reportingService.createReport(
          reporter.id,
          reported.id,
          REPORT_TYPES.SKILL,
          skill.id,
          REPORT_REASONS.SPAM,
          'Duplicate report'
        )
      ).rejects.toThrow('You have already reported this content');
    });

    it('should validate report target exists', async () => {
      const reporter = await createTestUser();
      const reported = await createTestUser();

      await expect(
        reportingService.createReport(
          reporter.id,
          reported.id,
          REPORT_TYPES.SKILL,
          99999, // Invalid skill ID
          REPORT_REASONS.INAPPROPRIATE,
          'Should fail'
        )
      ).rejects.toThrow('Invalid report target');
    });

    it('should update report counts in cache', async () => {
      const reporter = await createTestUser();
      const reported = await createTestUser();
      const skill = await createTestSkill({ user_id: reported.id });

      await reportingService.createReport(
        reporter.id,
        reported.id,
        REPORT_TYPES.SKILL,
        skill.id,
        REPORT_REASONS.INAPPROPRIATE,
        'Test report'
      );

      const counts = await redisService.client.hGetAll(`user:${reported.id}:reports`);
      expect(parseInt(counts.total)).toBeGreaterThan(0);
      expect(parseInt(counts.pending)).toBeGreaterThan(0);
    });
  });

  describe('moderateReport', () => {
    it('should apply moderation action', async () => {
      const { report } = await createTestReport();
      const moderator = await createTestUser({ is_admin: true });

      const result = await reportingService.moderateReport(
        report.id,
        moderator.id,
        MODERATION_ACTIONS.WARNING,
        'First warning',
        null
      );

      expect(result.status).toBe('resolved');
      expect(result.resolved_by).toBe(moderator.id);
    });

    it('should handle content removal', async () => {
      const { report, skill } = await createTestReport();
      const moderator = await createTestUser({ is_admin: true });

      await reportingService.moderateReport(
        report.id,
        moderator.id,
        MODERATION_ACTIONS.CONTENT_REMOVAL,
        'Inappropriate content',
        null
      );

      // Verify content was removed
      const skillCheck = await pool.query(
        'SELECT id FROM skills WHERE id = $1',
        [skill.id]
      );
      expect(skillCheck.rows).toHaveLength(0);
    });

    it('should handle user suspension', async () => {
      const { report, reported } = await createTestReport();
      const moderator = await createTestUser({ is_admin: true });

      await reportingService.moderateReport(
        report.id,
        moderator.id,
        MODERATION_ACTIONS.SUSPENSION,
        'Multiple violations',
        '7 days'
      );

      const userCheck = await pool.query(
        'SELECT is_suspended, suspension_end FROM users WHERE id = $1',
        [reported.id]
      );
      
      expect(userCheck.rows[0].is_suspended).toBe(true);
      expect(userCheck.rows[0].suspension_end).toBeTruthy();
    });

    it('should update report counts after moderation', async () => {
      const { report, reported } = await createTestReport();
      const moderator = await createTestUser({ is_admin: true });

      await reportingService.moderateReport(
        report.id,
        moderator.id,
        MODERATION_ACTIONS.WARNING,
        'Test warning'
      );

      const counts = await redisService.client.hGetAll(`user:${reported.id}:reports`);
      expect(parseInt(counts.pending)).toBe(0);
    });
  });

  describe('validateTarget', () => {
    it('should validate user reports', async () => {
      const user = await createTestUser();
      
      const isValid = await reportingService.validateTarget(
        REPORT_TYPES.USER,
        user.id,
        user.id
      );
      
      expect(isValid).toBe(true);
    });

    it('should validate skill reports', async () => {
      const user = await createTestUser();
      const skill = await createTestSkill({ user_id: user.id });
      
      const isValid = await reportingService.validateTarget(
        REPORT_TYPES.SKILL,
        skill.id,
        user.id
      );
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid targets', async () => {
      const isValid = await reportingService.validateTarget(
        REPORT_TYPES.SKILL,
        99999,
        1
      );
      
      expect(isValid).toBe(false);
    });
  });
}); 