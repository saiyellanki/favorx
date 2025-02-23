const { pool } = require('../../db');
const { 
  trustVerificationService, 
  VERIFICATION_TYPES, 
  VERIFICATION_STATUS 
} = require('../../services/trustVerificationService');
const { createTestUser } = require('../helpers/userHelpers');
const { 
  createTestVerification, 
  cleanupTestVerifications 
} = require('../helpers/verificationHelpers');

describe('Trust Verification Service', () => {
  afterAll(async () => {
    await cleanupTestVerifications();
    await pool.end();
  });

  describe('requestVerification', () => {
    it('should create verification request with documents', async () => {
      const user = await createTestUser();
      const documents = [
        { type: 'id_front', buffer: Buffer.from('test image data') }
      ];

      const verification = await trustVerificationService.requestVerification(
        user.id,
        VERIFICATION_TYPES.ID,
        { full_name: 'Test User' },
        documents
      );

      expect(verification).toMatchObject({
        user_id: user.id,
        type: VERIFICATION_TYPES.ID,
        status: VERIFICATION_STATUS.PENDING
      });
    });

    it('should throw error for duplicate pending verification', async () => {
      const { user } = await createTestVerification();

      await expect(
        trustVerificationService.requestVerification(
          user.id,
          VERIFICATION_TYPES.ID,
          { full_name: 'Test User' }
        )
      ).rejects.toThrow('A verification request is already pending');
    });
  });

  describe('approveVerification', () => {
    it('should approve verification and update karma', async () => {
      const { verification } = await createTestVerification();
      const adminId = (await createTestUser({ username: 'admin' })).id;

      const approvedVerification = await trustVerificationService.approveVerification(
        verification.id,
        adminId
      );

      expect(approvedVerification.status).toBe(VERIFICATION_STATUS.APPROVED);
      expect(approvedVerification.verified_at).toBeTruthy();
    });

    it('should throw error for non-existent verification', async () => {
      const adminId = (await createTestUser({ username: 'admin2' })).id;

      await expect(
        trustVerificationService.approveVerification(999999, adminId)
      ).rejects.toThrow('Verification request not found');
    });
  });

  describe('rejectVerification', () => {
    it('should reject verification with reason', async () => {
      const { verification } = await createTestVerification();
      const adminId = (await createTestUser({ username: 'admin3' })).id;

      const rejectedVerification = await trustVerificationService.rejectVerification(
        verification.id,
        adminId,
        'Documents unclear'
      );

      expect(rejectedVerification.status).toBe(VERIFICATION_STATUS.REJECTED);
      expect(rejectedVerification.verification_data).toHaveProperty('rejection_reason', 'Documents unclear');
    });
  });
}); 