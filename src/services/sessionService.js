const redisService = require('./redisService');
const security = require('../utils/security');
const config = require('../config/security');
const { AppError } = require('../utils/errorHandler');

const sessionService = {
  /**
   * Create new session
   */
  async createSession(userId, deviceInfo) {
    const sessionId = security.generateSecureToken();
    const session = {
      userId,
      deviceInfo,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    await redisService.setex(
      `session:${sessionId}`,
      config.session.duration,
      JSON.stringify(session)
    );

    return sessionId;
  },

  /**
   * Validate session
   */
  async validateSession(sessionId) {
    const session = await redisService.get(`session:${sessionId}`);
    if (!session) {
      throw new AppError('Invalid or expired session', 401);
    }

    const sessionData = JSON.parse(session);
    
    // Check for session expiry
    if (Date.now() - sessionData.lastActivity > config.session.inactivityTimeout) {
      await this.invalidateSession(sessionId);
      throw new AppError('Session expired due to inactivity', 401);
    }

    // Update last activity
    sessionData.lastActivity = Date.now();
    await redisService.setex(
      `session:${sessionId}`,
      config.session.duration,
      JSON.stringify(sessionData)
    );

    return sessionData;
  },

  /**
   * Invalidate session
   */
  async invalidateSession(sessionId) {
    await redisService.del(`session:${sessionId}`);
  },

  /**
   * Get all user sessions
   */
  async getUserSessions(userId) {
    const sessions = await redisService.keys(`session:*`);
    const activeSessions = [];

    for (const key of sessions) {
      const session = await redisService.get(key);
      if (session) {
        const sessionData = JSON.parse(session);
        if (sessionData.userId === userId) {
          activeSessions.push({
            sessionId: key.split(':')[1],
            ...sessionData
          });
        }
      }
    }

    return activeSessions;
  },

  /**
   * Invalidate all user sessions except current
   */
  async invalidateOtherSessions(userId, currentSessionId) {
    const sessions = await this.getUserSessions(userId);
    
    for (const session of sessions) {
      if (session.sessionId !== currentSessionId) {
        await this.invalidateSession(session.sessionId);
      }
    }
  }
};

module.exports = sessionService; 