const sessionService = require('../services/sessionService');
const { AppError } = require('../utils/errorHandler');

const sessionMiddleware = {
  /**
   * Validate session and attach to request
   */
  validateSession: async (req, res, next) => {
    try {
      const sessionId = req.cookies.sessionId;
      if (!sessionId) {
        throw new AppError('No session found', 401);
      }

      const session = await sessionService.validateSession(sessionId);
      req.session = session;
      next();
    } catch (error) {
      next(error);
    }
  },

  /**
   * Track user activity
   */
  trackActivity: async (req, res, next) => {
    if (req.session) {
      req.session.lastActivity = Date.now();
      await sessionService.updateSession(req.session.id, req.session);
    }
    next();
  },

  /**
   * Prevent session fixation
   */
  regenerateSession: async (req, res, next) => {
    try {
      const oldSessionId = req.cookies.sessionId;
      if (oldSessionId) {
        const oldSession = await sessionService.validateSession(oldSessionId);
        await sessionService.invalidateSession(oldSessionId);
        
        const newSessionId = await sessionService.createSession(
          oldSession.userId,
          req.useragent
        );

        res.cookie('sessionId', newSessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: config.session.duration
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  }
};

module.exports = sessionMiddleware; 