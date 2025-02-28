module.exports = {
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecial: true,
    maxAttempts: 3,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
  },

  // Session configuration
  session: {
    tokenExpiration: '1h',
    refreshTokenExpiration: '7d',
    tokenSecret: process.env.JWT_SECRET,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET
  },

  // CORS configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400
  },

  // Rate limiting
  rateLimit: {
    api: {
      windowMs: 15 * 60 * 1000,
      max: 100
    },
    auth: {
      windowMs: 60 * 60 * 1000,
      max: 3
    },
    trustedIps: process.env.TRUSTED_IPS?.split(',') || []
  },

  // File upload
  upload: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    scanEnabled: process.env.NODE_ENV === 'production'
  },

  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', process.env.AWS_S3_BUCKET],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}; 