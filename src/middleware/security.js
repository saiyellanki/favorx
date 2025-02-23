const helmet = require('helmet');

const securityMiddleware = {
  /**
   * Configure security headers
   */
  securityHeaders: [
    helmet(),
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', config.aws.s3Bucket],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    }),
    helmet.dnsPrefetchControl({ allow: false }),
    helmet.expectCt({ maxAge: 86400, enforce: true }),
    helmet.frameguard({ action: 'sameorigin' }),
    helmet.hsts({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }),
    helmet.ieNoOpen(),
    helmet.noSniff(),
    helmet.permittedCrossDomainPolicies(),
    helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }),
    helmet.xssFilter()
  ],

  /**
   * Prevent clickjacking
   */
  preventClickjacking: (req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  },

  /**
   * Set secure cookie flags
   */
  secureCookies: (req, res, next) => {
    res.cookie('sessionId', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    next();
  }
};

module.exports = securityMiddleware; 