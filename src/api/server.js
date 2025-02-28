const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const config = require('../config/config');
const db = require('../db');
const authRoutes = require('./routes/auth');
const { handleError } = require('../utils/errorHandler');
const swaggerSpecs = require('../docs/swagger');
const profileRoutes = require('./routes/profile');
const rateLimiter = require('../middleware/rateLimiter');
const skillRoutes = require('./routes/skills');
const redisService = require('../services/redisService');
const ratingRoutes = require('./routes/ratings');
const reviewRoutes = require('./routes/reviews');
const reportRoutes = require('./routes/reports');
const { sanitizeBody, sanitizeQuery, sanitizeParams } = require('../middleware/sanitization');
const { requestLogger, errorLogger } = require('../middleware/logging');
const loggingService = require('../services/loggingService');
const helmet = require('helmet');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const { securityHeaders, preventClickjacking, secureCookies } = require('../middleware/security');
const { AppError } = require('../utils/errorHandler');

const app = express();

// Connect to Redis
redisService.connect().catch(console.error);

// Add timeout middleware
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    next(new AppError('Request timeout', 408));
  });
  next();
});

// Middleware
app.use(cors({
  origin: config.allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400
}));
app.use(express.json());
app.use(morgan('combined', { stream: loggingService.stream }));
app.use(requestLogger);

// Sanitization middleware
app.use(sanitizeBody);
app.use(sanitizeQuery);
app.use(sanitizeParams);

app.use(rateLimiter.api); // Apply general rate limiting to all routes

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Security middleware
app.use(helmet());
app.use(hpp());
app.use(mongoSanitize());
app.use(securityHeaders);
app.use(preventClickjacking);
app.use(secureCookies);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorLogger);
app.use(handleError);

// Allow all IP addresses in development
const HOST = process.env.NODE_ENV === 'production' ? 'localhost' : '0.0.0.0';
const PORT = config.port;
app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT} in ${config.env} mode`);
  console.log(`API Documentation available at http://${HOST}:${PORT}/api-docs`);
});

module.exports = app; 