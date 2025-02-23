const { pool } = require('../db');
const { AppError } = require('../utils/errorHandler');
const { uploadToS3 } = require('../utils/fileUpload');
const karmaService = require('./karmaService');

const VERIFICATION_TYPES = {
  ID: 'id',
  ADDRESS: 'address',
  PROFESSIONAL: 'professional',
  SOCIAL: 'social'
};

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const trustVerificationService = {
  /**
   * Request a new verification
   */
  async requestVerification(userId, type, data, documents) {
    // Check if there's already a pending verification of this type
    const existingVerification = await pool.query(
      `SELECT id FROM trust_verifications 
       WHERE user_id = $1 AND type = $2 AND status = 'pending'`,
      [userId, type]
    );

    if (existingVerification.rows.length > 0) {
      throw new AppError('A verification request is already pending', 400);
    }

    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create verification request
      const verificationResult = await client.query(
        `INSERT INTO trust_verifications 
         (user_id, type, verification_data, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, type, data, VERIFICATION_STATUS.PENDING]
      );

      const verification = verificationResult.rows[0];

      // Upload and store documents if provided
      if (documents && documents.length > 0) {
        for (const doc of documents) {
          const documentUrl = await uploadToS3(doc.buffer, `verifications/${verification.id}`);
          await client.query(
            `INSERT INTO verification_documents 
             (verification_id, document_type, document_url)
             VALUES ($1, $2, $3)`,
            [verification.id, doc.type, documentUrl]
          );
        }
      }

      await client.query('COMMIT');
      return verification;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get verification status for a user
   */
  async getUserVerifications(userId) {
    const result = await pool.query(
      `SELECT v.*, d.document_type, d.document_url
       FROM trust_verifications v
       LEFT JOIN verification_documents d ON d.verification_id = v.id
       WHERE v.user_id = $1
       ORDER BY v.created_at DESC`,
      [userId]
    );

    // Group documents by verification
    const verifications = {};
    result.rows.forEach(row => {
      if (!verifications[row.id]) {
        verifications[row.id] = {
          id: row.id,
          type: row.type,
          status: row.status,
          data: row.verification_data,
          verified_at: row.verified_at,
          created_at: row.created_at,
          documents: []
        };
      }
      if (row.document_type) {
        verifications[row.id].documents.push({
          type: row.document_type,
          url: row.document_url
        });
      }
    });

    return Object.values(verifications);
  },

  /**
   * Approve a verification request
   */
  async approveVerification(verificationId, adminId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE trust_verifications 
         SET status = $1, verified_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [VERIFICATION_STATUS.APPROVED, verificationId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Verification request not found', 404);
      }

      const verification = result.rows[0];

      // Update user's karma score
      await karmaService.updateUserKarma(verification.user_id);

      await client.query('COMMIT');
      return verification;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Reject a verification request
   */
  async rejectVerification(verificationId, adminId, reason) {
    const result = await pool.query(
      `UPDATE trust_verifications 
       SET status = $1, 
           verification_data = verification_data || jsonb_build_object('rejection_reason', $2)
       WHERE id = $3
       RETURNING *`,
      [VERIFICATION_STATUS.REJECTED, reason, verificationId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Verification request not found', 404);
    }

    return result.rows[0];
  }
};

module.exports = {
  trustVerificationService,
  VERIFICATION_TYPES,
  VERIFICATION_STATUS
}; 