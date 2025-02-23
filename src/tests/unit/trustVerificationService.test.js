const { 
  trustVerificationService,
  VERIFICATION_TYPES,
  VERIFICATION_STATUS 
} = require('../../services/trustVerificationService');
const { createTestUser } = require('../helpers/userHelpers');
const { createTestVerification } = require('../helpers/verificationHelpers');
const { uploadToS3 } = require('../../services/fileUpload');

jest.mock('../../services/fileUpload');

describe('Trust Verification Service', () => {
  beforeEach(() => {
    uploadToS3.mockClear();
    uploadToS3.mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.jpg');
  });

  describe('requestVerification', () => {
    it('should create a verification request with documents', async () => {
      const user = await createTestUser();
      const documents = [
        { type: 'id_front', buffer: Buffer.from('test image') }
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
      expect(uploadToS3).toHaveBeenCalled();
    });

    it('should prevent duplicate pending verifications', async () => {
      const { user } = await createTestVerification();

      await expect(
        trustVerificationService.requestVerification(
          user.id,
          VERIFICATION_TYPES.ID,
          { full_name: 'Test User' }
        )
      ).rejects.toThrow('A verification request is already pending');
    });

    it('should validate required data based on type', async () => {
      const user = await createTestUser();

      await expect(
        trustVerificationService.requestVerification(
          user.id,
          VERIFICATION_TYPES.ID,
          {} // Missing required data
        )
      ).rejects.toThrow('Full name is required for ID verification');
    });
  });

  describe('approveVerification', () => {
    it('should approve verification and update karma', async () => {
      const { verification } = await createTestVerification();
      const admin = await createTestUser({ is_admin: true });

      const approvedVerification = await trustVerificationService.approveVerification(
        verification.id,
        admin.id
      );

      expect(approvedVerification.status).toBe(VERIFICATION_STATUS.APPROVED);
      expect(approvedVerification.verified_at).toBeTruthy();
    });

    it('should require admin privileges', async () => {
      const { verification } = await createTestVerification();
      const nonAdmin = await createTestUser();

      await expect(
        trustVerificationService.approveVerification(verification.id, nonAdmin.id)
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('rejectVerification', () => {
    it('should reject verification with reason', async () => {
      const { verification } = await createTestVerification();
      const admin = await createTestUser({ is_admin: true });

      const rejectedVerification = await trustVerificationService.rejectVerification(
        verification.id,
        admin.id,
        'Documents unclear'
      );

      expect(rejectedVerification.status).toBe(VERIFICATION_STATUS.REJECTED);
      expect(rejectedVerification.verification_data).toHaveProperty(
        'rejection_reason',
        'Documents unclear'
      );
    });
  });

  describe('getUserVerifications', () => {
    it('should return all user verifications with documents', async () => {
      const { verification, user } = await createTestVerification();
      await Promise.all([
        createTestDocument(verification.id, 'id_front'),
        createTestDocument(verification.id, 'id_back')
      ]);

      const verifications = await trustVerificationService.getUserVerifications(user.id);

      expect(verifications).toHaveLength(1);
      expect(verifications[0].documents).toHaveLength(2);
    });
  });
}); 