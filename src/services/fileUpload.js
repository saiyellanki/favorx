const fileUpload = {
  uploadToS3: async (file, userId) => {
    // Add file type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new AppError('Invalid file type', 400);
    }

    // Add file size limit
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new AppError('File too large', 400);
    }

    // Add virus scanning
    await scanFile(file.buffer);

    // Generate secure filename
    const filename = `${userId}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    const params = {
      Bucket: config.aws.s3Bucket,
      Key: filename,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Add security headers
      Metadata: {
        'x-amz-meta-original-name': file.originalname
      }
    };

    return s3.upload(params).promise();
  }
}; 