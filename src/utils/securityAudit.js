const loggingService = require('../services/loggingService');
const config = require('../config/config');

const securityAudit = {
  /**
   * Check security headers
   */
  checkSecurityHeaders(app) {
    const missingHeaders = [];
    const requiredHeaders = {
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; script-src 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    // Check if headers are set
    for (const [header, value] of Object.entries(requiredHeaders)) {
      if (!app._router.stack.some(layer => 
        layer.handle && 
        layer.handle.toString().includes(header)
      )) {
        missingHeaders.push(header);
      }
    }

    return {
      passed: missingHeaders.length === 0,
      missingHeaders
    };
  },

  /**
   * Check environment configuration
   */
  checkEnvironmentConfig() {
    const requiredConfigs = [
      'jwtSecret',
      'db.password',
      'email.pass',
      'aws.secretAccessKey'
    ];

    const missingConfigs = requiredConfigs.filter(path => {
      const keys = path.split('.');
      let current = config;
      for (const key of keys) {
        if (!current[key]) return true;
        current = current[key];
      }
      return false;
    });

    return {
      passed: missingConfigs.length === 0,
      missingConfigs
    };
  },

  /**
   * Check rate limiting configuration
   */
  checkRateLimiting(app) {
    const requiredLimiters = [
      'api',
      'auth',
      'profileUpdate',
      'search',
      'matching',
      'ratingCreate',
      'reviewCreate',
      'reportCreate',
      'imageUpload'
    ];

    const missingLimiters = requiredLimiters.filter(limiter => 
      !app._router.stack.some(layer =>
        layer.handle && 
        layer.handle.toString().includes(`rateLimiter.${limiter}`)
      )
    );

    return {
      passed: missingLimiters.length === 0,
      missingLimiters
    };
  },

  /**
   * Check input validation
   */
  checkInputValidation(app) {
    const requiredValidators = [
      'registerValidation',
      'loginValidation',
      'profileValidation',
      'skillValidation',
      'ratingValidation',
      'reviewValidation',
      'reportValidation'
    ];

    const missingValidators = requiredValidators.filter(validator =>
      !app._router.stack.some(layer =>
        layer.handle &&
        layer.handle.toString().includes(`validators.${validator}`)
      )
    );

    return {
      passed: missingValidators.length === 0,
      missingValidators
    };
  },

  /**
   * Check authentication configuration
   */
  checkAuthConfig() {
    const authChecks = {
      jwtSecret: config.jwtSecret && config.jwtSecret.length >= 32,
      jwtExpiration: true, // Add check for JWT expiration time
      passwordHashing: true, // Add check for bcrypt configuration
      sessionHandling: true // Add check for session configuration
    };

    const failedChecks = Object.entries(authChecks)
      .filter(([, passed]) => !passed)
      .map(([check]) => check);

    return {
      passed: failedChecks.length === 0,
      failedChecks
    };
  },

  /**
   * Run all security checks
   */
  async runSecurityAudit(app) {
    const results = {
      headers: this.checkSecurityHeaders(app),
      config: this.checkEnvironmentConfig(),
      rateLimiting: this.checkRateLimiting(app),
      inputValidation: this.checkInputValidation(app),
      auth: this.checkAuthConfig()
    };

    // Log results
    if (Object.values(results).some(check => !check.passed)) {
      loggingService.warn('Security audit failed', { results });
    } else {
      loggingService.info('Security audit passed', { results });
    }

    return results;
  }
};

module.exports = securityAudit; 