const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');
const config = require('../config/config');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Add colors to Winston
winston.addColors(colors);

// Create Elasticsearch transport
const esTransport = new ElasticsearchTransport({
  level: 'info',
  clientOpts: {
    node: config.elasticsearch.url,
    auth: {
      username: config.elasticsearch.username,
      password: config.elasticsearch.password
    }
  },
  indexPrefix: 'favorx-logs',
  indexSuffixPattern: 'YYYY.MM.DD'
});

// Create console format
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create file format
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  levels,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat
    }),
    // Elasticsearch transport
    esTransport
  ]
});

// Create a stream for Morgan HTTP logging
logger.stream = {
  write: (message) => logger.http(message.trim())
};

const loggingService = {
  /**
   * Log an error with stack trace and metadata
   */
  error(err, metadata = {}) {
    logger.error({
      message: err.message,
      stack: err.stack,
      ...metadata
    });
  },

  /**
   * Log a warning
   */
  warn(message, metadata = {}) {
    logger.warn({
      message,
      ...metadata
    });
  },

  /**
   * Log info level message
   */
  info(message, metadata = {}) {
    logger.info({
      message,
      ...metadata
    });
  },

  /**
   * Log HTTP request details
   */
  http(message, metadata = {}) {
    logger.http({
      message,
      ...metadata
    });
  },

  /**
   * Log debug information
   */
  debug(message, metadata = {}) {
    logger.debug({
      message,
      ...metadata
    });
  },

  /**
   * Log API request
   */
  logRequest(req, metadata = {}) {
    logger.http({
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.headers['user-agent'],
      ...metadata
    });
  },

  /**
   * Log API response
   */
  logResponse(req, res, responseTime, metadata = {}) {
    logger.http({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      responseTime,
      userId: req.user?.id,
      ...metadata
    });
  },

  /**
   * Log security events
   */
  logSecurity(event, metadata = {}) {
    logger.warn({
      type: 'security',
      event,
      ...metadata
    });
  },

  /**
   * Log performance metrics
   */
  logPerformance(metric, value, metadata = {}) {
    logger.info({
      type: 'performance',
      metric,
      value,
      ...metadata
    });
  }
};

module.exports = loggingService; 