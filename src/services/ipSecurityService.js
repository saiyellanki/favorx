const geoip = require('geoip-lite');
const { AppError } = require('../utils/errorHandler');
const securityAuditService = require('./securityAuditService');
const redisService = require('./redisService');

const ipSecurityService = {
  /**
   * Check if IP is allowed for user
   */
  async isIpAllowed(userId, ip) {
    const { rows } = await pool.query(
      'SELECT allowed_ips FROM security_settings WHERE user_id = $1',
      [userId]
    );

    if (!rows.length || !rows[0].allowed_ips) {
      return true; // No restrictions
    }

    const allowedIps = rows[0].allowed_ips;
    return this.checkIpAgainstRules(ip, allowedIps);
  },

  /**
   * Check IP against rules
   */
  checkIpAgainstRules(ip, rules) {
    // Check exact matches
    if (rules.exact && rules.exact.includes(ip)) {
      return true;
    }

    // Check CIDR ranges
    if (rules.ranges) {
      for (const range of rules.ranges) {
        if (this.isIpInRange(ip, range)) {
          return true;
        }
      }
    }

    // Check allowed countries
    if (rules.countries) {
      const geo = geoip.lookup(ip);
      if (geo && rules.countries.includes(geo.country)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Add IP to allowed list
   */
  async addAllowedIp(userId, ip, type = 'exact') {
    const { rows } = await pool.query(
      'SELECT allowed_ips FROM security_settings WHERE user_id = $1',
      [userId]
    );

    let allowedIps = rows[0]?.allowed_ips || { exact: [], ranges: [], countries: [] };

    switch (type) {
      case 'exact':
        if (!allowedIps.exact.includes(ip)) {
          allowedIps.exact.push(ip);
        }
        break;
      case 'range':
        if (!allowedIps.ranges.includes(ip)) {
          allowedIps.ranges.push(ip);
        }
        break;
      case 'country':
        if (!allowedIps.countries.includes(ip)) {
          allowedIps.countries.push(ip);
        }
        break;
    }

    await pool.query(
      'UPDATE security_settings SET allowed_ips = $1 WHERE user_id = $2',
      [allowedIps, userId]
    );

    await securityAuditService.logSecurityEvent('ip_whitelist_updated', {
      userId,
      ip,
      type
    });
  },

  /**
   * Check for suspicious IP activity
   */
  async checkSuspiciousIp(ip, action) {
    const key = `security:ip:${ip}:${action}`;
    const count = await redisService.client.incr(key);
    await redisService.client.expire(key, 3600);

    const thresholds = {
      login_attempts: 10,
      api_requests: 1000,
      failed_2fa: 5
    };

    if (count > thresholds[action]) {
      await securityAuditService.logSecurityEvent('suspicious_ip', {
        ip,
        action,
        count
      });
      return true;
    }

    return false;
  }
};

module.exports = ipSecurityService; 