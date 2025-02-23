const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FavorX API',
      version: '1.0.0',
      description: 'API documentation for the FavorX platform',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            karma_score: { type: 'number' },
            is_verified: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Profile: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            full_name: { type: 'string' },
            bio: { type: 'string' },
            location: { type: 'string' },
            profile_image_url: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' }
          }
        },
        Skill: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            category: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            effort_time: { type: 'integer' },
            is_offering: { type: 'boolean' }
          }
        },
        Rating: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            rater_id: { type: 'integer' },
            rated_id: { type: 'integer' },
            skill_id: { type: 'integer' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            review: { type: 'string' }
          }
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            reviewer_id: { type: 'integer' },
            reviewed_id: { type: 'integer' },
            skill_id: { type: 'integer' },
            title: { type: 'string' },
            content: { type: 'string' },
            is_verified: { type: 'boolean' }
          }
        },
        Report: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            reporter_id: { type: 'integer' },
            reported_id: { type: 'integer' },
            type: { type: 'string', enum: ['user', 'skill', 'review', 'rating'] },
            target_id: { type: 'integer' },
            reason: { type: 'string', enum: ['inappropriate', 'spam', 'harassment', 'fake', 'scam', 'other'] },
            description: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'resolved', 'rejected'] }
          }
        },
        Verification: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            type: { type: 'string', enum: ['id', 'address', 'professional', 'social'] },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
            verification_data: { type: 'object' },
            verified_at: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            status: { type: 'integer' }
          }
        }
      }
    }
  },
  apis: ['./src/api/routes/*.js'] // Path to the API routes
};

const swaggerSpecs = swaggerJsdoc(options);

module.exports = swaggerSpecs; 