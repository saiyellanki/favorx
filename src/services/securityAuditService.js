const loggingService = require('./loggingService');
const redisService = require('./redisService');
const { pool } = require('../db');

const securityAuditService = {
  /**
   * Log security event
   */
  async logSecurityEvent(event, metadata = {}) {
    const eventData = {
      timestamp: new Date(),
      event,
      ...metadata
    };

    // Log to database
    await pool.query(
      'INSERT INTO security_events (event_type, metadata) VALUES ($1, $2)',
      [event, JSON.stringify(eventData)]
    );

    // Log to application logs
    loggingService.logSecurity(event, metadata);

    // Update security metrics
    await this.updateSecurityMetrics(event);
  },

  /**
   * Update security metrics
   */
  async updateSecurityMetrics(event) {
    const now = Date.now();
    const hourKey = `security:metrics:${Math.floor(now / 3600000)}`;

    await redisService.client
      .multi()
      .hincrby(hourKey, event, 1)
      .hincrby(hourKey, 'total', 1)
      .expire(hourKey, 86400) // Keep for 24 hours
      .exec();
  },

  /**
   * Get security metrics
   */
  async getSecurityMetrics(hours = 24) {
    const now = Math.floor(Date.now() / 3600000);
    const metrics = [];

    for (let i = 0; i < hours; i++) {
      const hourKey = `security:metrics:${now - i}`;
      const data = await redisService.client.hgetall(hourKey);
      if (data) {
        metrics.push({
          hour: now - i,
          ...data
        });
      }
    }

    return metrics;
  },

  /**
   * Check for suspicious activity
   */
  async checkSuspiciousActivity(userId, action) {
    const key = `security:activity:${userId}:${action}`;
    const count = await redisService.client.incr(key);
    await redisService.client.expire(key, 3600); // Reset after 1 hour

    const thresholds = {
      login_attempts: 5,
      password_resets: 3,
      report_submissions: 10
    };

    if (count > thresholds[action]) {
      await this.logSecurityEvent('suspicious_activity', {
        userId,
        action,
        count
      });
      return true;
    }

    return false;
  }
};

module.exports = securityAuditService; 