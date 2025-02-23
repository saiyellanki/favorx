const { pool } = require('../db');
const { AppError } = require('../utils/errorHandler');
const redisService = require('./redisService');

const REPORT_TYPES = {
  USER: 'user',
  SKILL: 'skill',
  REVIEW: 'review',
  RATING: 'rating'
};

const REPORT_STATUS = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  REJECTED: 'rejected'
};

const REPORT_REASONS = {
  INAPPROPRIATE: 'inappropriate',
  SPAM: 'spam',
  HARASSMENT: 'harassment',
  FAKE: 'fake',
  SCAM: 'scam',
  OTHER: 'other'
};

const MODERATION_ACTIONS = {
  WARNING: 'warning',
  SUSPENSION: 'suspension',
  BAN: 'ban',
  CONTENT_REMOVAL: 'content_removal'
};

const reportingService = {
  /**
   * Create a new report
   */
  async createReport(reporterId, reportedId, type, targetId, reason, description) {
    // Validate report type
    if (!Object.values(REPORT_TYPES).includes(type)) {
      throw new AppError('Invalid report type', 400);
    }

    // Validate reason
    if (!Object.values(REPORT_REASONS).includes(reason)) {
      throw new AppError('Invalid report reason', 400);
    }

    // Check if target exists
    const targetExists = await this.validateTarget(type, targetId, reportedId);
    if (!targetExists) {
      throw new AppError('Invalid report target', 404);
    }

    // Check for duplicate reports
    const existingReport = await pool.query(
      `SELECT id FROM reports 
       WHERE reporter_id = $1 
       AND type = $2 
       AND target_id = $3 
       AND status = $4`,
      [reporterId, type, targetId, REPORT_STATUS.PENDING]
    );

    if (existingReport.rows.length > 0) {
      throw new AppError('You have already reported this content', 400);
    }

    // Create report
    const result = await pool.query(
      `INSERT INTO reports 
       (reporter_id, reported_id, type, target_id, reason, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [reporterId, reportedId, type, targetId, reason, description, REPORT_STATUS.PENDING]
    );

    // Cache report count for quick access
    await this.updateReportCounts(reportedId);

    return result.rows[0];
  },

  /**
   * Validate report target exists and belongs to reported user
   */
  async validateTarget(type, targetId, reportedId) {
    let query;
    switch (type) {
      case REPORT_TYPES.USER:
        query = 'SELECT id FROM users WHERE id = $1';
        break;
      case REPORT_TYPES.SKILL:
        query = 'SELECT id FROM skills WHERE id = $1 AND user_id = $2';
        break;
      case REPORT_TYPES.REVIEW:
        query = 'SELECT id FROM reviews WHERE id = $1 AND reviewer_id = $2';
        break;
      case REPORT_TYPES.RATING:
        query = 'SELECT id FROM ratings WHERE id = $1 AND rater_id = $2';
        break;
      default:
        return false;
    }

    const result = await pool.query(
      query,
      type === REPORT_TYPES.USER ? [targetId] : [targetId, reportedId]
    );

    return result.rows.length > 0;
  },

  /**
   * Update cached report counts for a user
   */
  async updateReportCounts(userId) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = $1 THEN 1 END) as pending_reports
       FROM reports 
       WHERE reported_id = $2`,
      [REPORT_STATUS.PENDING, userId]
    );

    const { total_reports, pending_reports } = result.rows[0];
    await redisService.client.hSet(`user:${userId}:reports`, {
      total: total_reports,
      pending: pending_reports
    });

    return { total_reports, pending_reports };
  },

  /**
   * Take moderation action on a report
   */
  async moderateReport(reportId, moderatorId, action, reason, duration = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get report details
      const reportResult = await client.query(
        'SELECT * FROM reports WHERE id = $1',
        [reportId]
      );

      if (reportResult.rows.length === 0) {
        throw new AppError('Report not found', 404);
      }

      const report = reportResult.rows[0];

      // Create moderation action
      await client.query(
        `INSERT INTO moderation_actions 
         (report_id, moderator_id, action_type, reason, duration)
         VALUES ($1, $2, $3, $4, $5)`,
        [reportId, moderatorId, action, reason, duration]
      );

      // Update report status
      await client.query(
        `UPDATE reports 
         SET status = $1, resolved_by = $2, resolved_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [REPORT_STATUS.RESOLVED, moderatorId, reportId]
      );

      // Apply moderation action
      await this.applyModerationAction(
        client,
        action,
        report.reported_id,
        report.type,
        report.target_id,
        duration
      );

      await client.query('COMMIT');

      // Update report counts
      await this.updateReportCounts(report.reported_id);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Apply moderation action
   */
  async applyModerationAction(client, action, userId, type, targetId, duration) {
    switch (action) {
      case MODERATION_ACTIONS.WARNING:
        // Just create a warning record
        break;

      case MODERATION_ACTIONS.SUSPENSION:
        await client.query(
          `UPDATE users 
           SET is_suspended = true, 
               suspension_end = CURRENT_TIMESTAMP + $1
           WHERE id = $2`,
          [duration, userId]
        );
        break;

      case MODERATION_ACTIONS.BAN:
        await client.query(
          'UPDATE users SET is_banned = true WHERE id = $1',
          [userId]
        );
        break;

      case MODERATION_ACTIONS.CONTENT_REMOVAL:
        await this.removeContent(client, type, targetId);
        break;

      default:
        throw new AppError('Invalid moderation action', 400);
    }
  },

  /**
   * Remove reported content
   */
  async removeContent(client, type, targetId) {
    let query;
    switch (type) {
      case REPORT_TYPES.SKILL:
        query = 'DELETE FROM skills WHERE id = $1';
        break;
      case REPORT_TYPES.REVIEW:
        query = 'DELETE FROM reviews WHERE id = $1';
        break;
      case REPORT_TYPES.RATING:
        query = 'DELETE FROM ratings WHERE id = $1';
        break;
      default:
        throw new AppError('Cannot remove this type of content', 400);
    }

    await client.query(query, [targetId]);
  }
};

module.exports = {
  reportingService,
  REPORT_TYPES,
  REPORT_STATUS,
  REPORT_REASONS,
  MODERATION_ACTIONS
}; 