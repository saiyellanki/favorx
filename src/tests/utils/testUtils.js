const jwt = require('jsonwebtoken');
const config = require('../../config/config');

const testUtils = {
  /**
   * Generate test JWT token
   */
  generateTestToken(userId, isAdmin = false) {
    return jwt.sign(
      { 
        id: userId,
        is_admin: isAdmin
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
  },

  /**
   * Generate random test data
   */
  generateTestData() {
    return {
      user: {
        username: `test_user_${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        password: 'TestPassword123!'
      },
      profile: {
        full_name: 'Test User',
        bio: 'Test bio',
        location: 'Test City',
        latitude: 40.7128,
        longitude: -74.0060
      },
      skill: {
        category: 'Test Category',
        title: 'Test Skill',
        description: 'Test description',
        effort_time: 60,
        is_offering: true
      }
    };
  },

  /**
   * Mock external services
   */
  mockExternalServices() {
    jest.mock('../../services/emailService', () => ({
      sendEmail: jest.fn().mockResolvedValue(true)
    }));

    jest.mock('../../services/fileUpload', () => ({
      uploadToS3: jest.fn().mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.jpg')
    }));
  },

  /**
   * Create test file buffer
   */
  createTestFileBuffer() {
    return Buffer.from('test file content');
  }
};

module.exports = testUtils; 