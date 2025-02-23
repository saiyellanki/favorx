const deviceSecurityService = require('../services/deviceSecurityService');
const { AppError } = require('../utils/errorHandler');

const deviceAuth = {
  /**
   * Verify device authentication
   */
  verifyDevice: async (req, res, next) => {
    try {
      const deviceId = req.cookies.deviceId;
      if (!deviceId) {
        // New device, needs registration
        const newDeviceId = await deviceSecurityService.registerDevice(
          req.user.id,
          req.headers['user-agent'],
          req.ip
        );

        // Set device cookie
        res.cookie('deviceId', newDeviceId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
        });

        // Require additional verification for new device
        throw new AppError('New device requires verification', 403, {
          requireVerification: true,
          deviceId: newDeviceId
        });
      }

      // Verify existing device
      const isVerified = await deviceSecurityService.verifyDevice(
        req.user.id,
        deviceId,
        req.ip
      );

      if (!isVerified) {
        throw new AppError('Device verification required', 403, {
          requireVerification: true,
          deviceId
        });
      }

      // Attach device info to request
      req.device = await deviceSecurityService.getDeviceById(deviceId);
      next();
    } catch (error) {
      next(error);
    }
  },

  /**
   * Require trusted device
   */
  requireTrustedDevice: async (req, res, next) => {
    if (!req.device?.is_trusted) {
      throw new AppError('Trusted device required for this action', 403);
    }
    next();
  }
};

module.exports = deviceAuth; 