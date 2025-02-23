const request = require('supertest');
const app = require('../../api/server');
const { pool } = require('../../db');

const testUtils = {
  createTestUser: async (userData = {}) => {
    const defaultUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPassword123'
    };

    const user = { ...defaultUser, ...userData };
    const response = await request(app)
      .post('/api/auth/register')
      .send(user);

    return response.body;
  },

  loginTestUser: async (credentials) => {
    const response = await request(app)
      .post('/api/auth/login')
      .send(credentials);

    return response.body;
  },

  cleanupTestUser: async (email) => {
    await pool.query('DELETE FROM skills WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email]);
    await pool.query('DELETE FROM verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email]);
    await pool.query('DELETE FROM profiles WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email]);
    await pool.query('DELETE FROM users WHERE email = $1', [email]);
  },

  createTestSkill: async (userId, skillData) => {
    const result = await pool.query(
      `INSERT INTO skills 
       (user_id, category, title, description, effort_time, is_offering)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        skillData.category,
        skillData.title,
        skillData.description,
        skillData.effort_time,
        skillData.is_offering
      ]
    );
    return result.rows[0];
  },

  cleanupTestSkills: async (userId) => {
    await pool.query('DELETE FROM skills WHERE user_id = $1', [userId]);
  }
};

module.exports = testUtils; 