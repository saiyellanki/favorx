const { v4: uuidv4 } = require('uuid');
const UAParser = require('ua-parser-js');
const { AppError } = require('../utils/errorHandler');
const securityAuditService = require('./securityAuditService');
const redisService = require('./redisService');

const deviceSecurityService = {
  /**
   * Register new device
   */
  async registerDevice(userId, userAgent, ip) {
    const deviceId = uuidv4();
    const parser = new UAParser(userAgent);
    const deviceInfo = {
      browser: parser.getBrowser(),
      os: parser.getOS(),
      device: parser.getDevice()
    };

    const deviceName = this.generateDeviceName(deviceInfo);

    await pool.query(`
      INSERT INTO user_devices (
        user_id, device_id, device_name, device_type,
        device_info, last_ip, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      userId,
      deviceId,
      deviceName,
      deviceInfo.device.type || 'desktop',
      JSON.stringify(deviceInfo),
      ip
    ]);

    await securityAuditService.logSecurityEvent('device_registered', {
      userId,
      deviceId,
      deviceInfo,
      ip
    });

    return deviceId;
  },

  /**
   * Verify device
   */
  async verifyDevice(userId, deviceId, ip) {
    const { rows } = await pool.query(`
      SELECT * FROM user_devices 
      WHERE user_id = $1 AND device_id = $2
    `, [userId, deviceId]);

    if (!rows.length) {
      throw new AppError('Unknown device', 401);
    }

    const device = rows[0];

    // Check if device is trusted
    if (!device.is_trusted) {
      // Check if IP matches last known IP
      if (device.last_ip !== ip) {
        await securityAuditService.logSecurityEvent('device_ip_mismatch', {
          userId,
          deviceId,
          expectedIp: device.last_ip,
          actualIp: ip
        });
        return false;
      }
    }

    // Update last used timestamp
    await pool.query(`
      UPDATE user_devices 
      SET last_used_at = NOW(), last_ip = $1 
      WHERE id = $2
    `, [ip, device.id]);

    return true;
  },

  /**
   * Trust device
   */
  async trustDevice(userId, deviceId) {
    const { rows } = await pool.query(`
      UPDATE user_devices 
      SET is_trusted = TRUE 
      WHERE user_id = $1 AND device_id = $2 
      RETURNING *
    `, [userId, deviceId]);

    if (!rows.length) {
      throw new AppError('Device not found', 404);
    }

    await securityAuditService.logSecurityEvent('device_trusted', {
      userId,
      deviceId
    });

    return rows[0];
  },

  /**
   * Remove device
   */
  async removeDevice(userId, deviceId) {
    const { rows } = await pool.query(`
      DELETE FROM user_devices 
      WHERE user_id = $1 AND device_id = $2 
      RETURNING *
    `, [userId, deviceId]);

    if (!rows.length) {
      throw new AppError('Device not found', 404);
    }

    await securityAuditService.logSecurityEvent('device_removed', {
      userId,
      deviceId
    });

    // Invalidate any active sessions for this device
    await redisService.del(`session:${deviceId}:*`);
  },

  /**
   * Get user devices
   */
  async getUserDevices(userId) {
    const { rows } = await pool.query(`
      SELECT * FROM user_devices 
      WHERE user_id = $1 
      ORDER BY last_used_at DESC
    `, [userId]);

    return rows;
  },

  /**
   * Check for suspicious device activity
   */
  async checkSuspiciousDevice(deviceId, action) {
    const key = `security:device:${deviceId}:${action}`;
    const count = await redisService.client.incr(key);
    await redisService.client.expire(key, 3600);

    const thresholds = {
      login_attempts: 5,
      location_changes: 3,
      failed_2fa: 3
    };

    if (count > thresholds[action]) {
      const device = await this.getDeviceById(deviceId);
      await securityAuditService.logSecurityEvent('suspicious_device', {
        deviceId,
        userId: device.user_id,
        action,
        count
      });
      return true;
    }

    return false;
  },

  /**
   * Generate readable device name
   */
  generateDeviceName(deviceInfo) {
    const os = deviceInfo.os.name || 'Unknown OS';
    const browser = deviceInfo.browser.name || 'Unknown Browser';
    const device = deviceInfo.device.type 
      ? deviceInfo.device.type.charAt(0).toUpperCase() + deviceInfo.device.type.slice(1)
      : 'Desktop';

    return `${device} - ${os} (${browser})`;
  }
};

module.exports = deviceSecurityService; 