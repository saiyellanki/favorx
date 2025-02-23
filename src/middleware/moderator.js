const { AppError } = require('../utils/errorHandler');

const moderatorMiddleware = {
  requireModerator: (req, res, next) => {
    if (!req.user.is_moderator) {
      throw new AppError('Unauthorized: Moderator access required', 403);
    }
    next();
  }
};

module.exports = moderatorMiddleware; 