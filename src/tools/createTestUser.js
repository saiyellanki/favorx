const { pool } = require('../db');
const bcrypt = require('bcrypt');

async function createTestUser() {
  const testUser = {
    username: 'testadmin',
    email: 'admin@favorx.test',
    password: 'TestAdmin123!'
  };

  try {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(testUser.password, salt);

    // Create user
    const { rows } = await pool.query(`
      INSERT INTO users (
        username, 
        email, 
        password_hash, 
        is_admin,
        is_verified
      ) VALUES ($1, $2, $3, true, true)
      RETURNING id
    `, [testUser.username, testUser.email, passwordHash]);

    // Create profile
    await pool.query(`
      INSERT INTO profiles (user_id, full_name)
      VALUES ($1, $2)
    `, [rows[0].id, 'Test Admin']);

    // Create security settings
    await pool.query(`
      INSERT INTO security_settings (user_id)
      VALUES ($1)
    `, [rows[0].id]);

    console.log('Test admin account created:');
    console.log('Email:', testUser.email);
    console.log('Password:', testUser.password);

  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await pool.end();
  }
}

createTestUser(); 