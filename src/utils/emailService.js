const nodemailer = require('nodemailer');
const config = require('../config/config');

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: {
    user: config.email.user,
    pass: config.email.pass
  }
});

const sendVerificationEmail = async (to, token) => {
  const verificationUrl = `${config.baseUrl}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: config.email.user,
    to: to,
    subject: 'Verify your FavorX account',
    html: `
      <h1>Welcome to FavorX!</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create a FavorX account, please ignore this email.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new Error(`Error sending verification email: ${error.message}`);
  }
};

module.exports = {
  sendVerificationEmail
}; 