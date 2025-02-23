const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

const s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region
});

const uploadToS3 = async (file, folder = 'profiles') => {
  const fileExtension = file.originalname.split('.').pop();
  const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

  const params = {
    Bucket: config.aws.s3Bucket,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read'
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    throw new Error(`Error uploading to S3: ${error.message}`);
  }
};

const deleteFromS3 = async (fileUrl) => {
  const key = fileUrl.split('/').slice(-2).join('/');
  
  const params = {
    Bucket: config.aws.s3Bucket,
    Key: key
  };

  try {
    await s3.deleteObject(params).promise();
  } catch (error) {
    throw new Error(`Error deleting from S3: ${error.message}`);
  }
};

module.exports = {
  uploadToS3,
  deleteFromS3
}; 