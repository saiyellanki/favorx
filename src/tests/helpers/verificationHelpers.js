const { pool } = require('../../db');
const { createTestUser } = require('./userHelpers');
const { VERIFICATION_TYPES, VERIFICATION_STATUS } = require('../../services/trustVerificationService');

const verificationHelpers = {
  /**
   * Create a test verification request
   */
  async createTestVerification(overrides = {}) {
    const user = await createTestUser({ username: 'test_verification_user' });

    const verificationData = {
      user_id: user.id,
      type: VERIFICATION_TYPES.ID,
      status: VERIFICATION_STATUS.PENDING,
      verification_data: {
        full_name: 'Test User',
        id_number: 'TEST123456',
        date_of_birth: '1990-01-01'
      },
      ...overrides
    };

    const result = await pool.query(
      `INSERT INTO trust_verifications 
       (user_id, type, status, verification_data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        verificationData.user_id,
        verificationData.type,
        verificationData.status,
        verificationData.verification_data
      ]
    );

    return {
      verification: result.rows[0],
      user
    };
  },

  /**
   * Create a test verification document
   */
  async createTestDocument(verificationId, documentType = 'id_front') {
    const result = await pool.query(
      `INSERT INTO verification_documents 
       (verification_id, document_type, document_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [verificationId, documentType, `https://test-bucket.s3.amazonaws.com/test-${documentType}.jpg`]
    );

    return result.rows[0];
  },

  /**
   * Clean up test verifications
   */
  async cleanupTestVerifications() {
    await pool.query('DELETE FROM verification_documents WHERE document_url LIKE \'%test%\'');
    await pool.query('DELETE FROM trust_verifications WHERE verification_data->\'full_name\' ? \'Test\'');
  }
};

module.exports = verificationHelpers; 