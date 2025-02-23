const express = require('express');
const auth = require('../../middleware/auth');
const { requireModerator } = require('../../middleware/moderator');
const validators = require('../../middleware/validators');
const rateLimiter = require('../../middleware/rateLimiter');
const { 
  reportingService, 
  REPORT_TYPES, 
  REPORT_REASONS, 
  MODERATION_ACTIONS 
} = require('../../services/reportingService');

const router = express.Router();

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Submit a new report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/',
  auth.requireAuth,
  rateLimiter.reportCreate,
  validators.reportValidation,
  validators.validate,
  async (req, res, next) => {
    try {
      const { reported_id, type, target_id, reason, description } = req.body;

      const report = await reportingService.createReport(
        req.user.id,
        reported_id,
        type,
        target_id,
        reason,
        description
      );

      res.status(201).json({
        message: 'Report submitted successfully',
        report
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/reports/moderate/{reportId}:
 *   post:
 *     summary: Take moderation action on a report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/moderate/:reportId',
  auth.requireAuth,
  requireModerator,
  validators.moderationValidation,
  validators.validate,
  async (req, res, next) => {
    try {
      const { action, reason, duration } = req.body;

      await reportingService.moderateReport(
        req.params.reportId,
        req.user.id,
        action,
        reason,
        duration
      );

      res.json({
        message: 'Moderation action applied successfully'
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Get reports (for moderators)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/',
  auth.requireAuth,
  requireModerator,
  async (req, res, next) => {
    try {
      const { 
        status = 'pending',
        page = 1,
        limit = 10,
        type,
        sort = 'created_at',
        order = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;

      let query = `
        SELECT r.*, 
          reporter.username as reporter_username,
          reported.username as reported_username
        FROM reports r
        JOIN users reporter ON reporter.id = r.reporter_id
        JOIN users reported ON reported.id = r.reported_id
        WHERE r.status = $1
      `;
      const params = [status];

      if (type) {
        query += ` AND r.type = $${params.length + 1}`;
        params.push(type);
      }

      query += ` ORDER BY r.${sort} ${order}`;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const [reportsResult, countResult] = await Promise.all([
        pool.query(query, params),
        pool.query(
          'SELECT COUNT(*) FROM reports WHERE status = $1',
          [status]
        )
      ]);

      res.json({
        reports: reportsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalItems: parseInt(countResult.rows[0].count),
          totalPages: Math.ceil(countResult.rows[0].count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
});

module.exports = router; 