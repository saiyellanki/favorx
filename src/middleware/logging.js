const loggingService = require('../services/loggingService');

const loggingMiddleware = {
  /**
   * Log request and response details
   */
  requestLogger: (req, res, next) => {
    const start = Date.now();

    // Log request
    loggingService.logRequest(req);

    // Log response when finished
    res.on('finish', () => {
      const responseTime = Date.now() - start;
      loggingService.logResponse(req, res, responseTime);
    });

    next();
  },

  /**
   * Log errors
   */
  errorLogger: (err, req, res, next) => {
    loggingService.error(err, {
      method: req.method,
      url: req.url,
      userId: req.user?.id
    });
    next(err);
  }
};

module.exports = loggingMiddleware; 