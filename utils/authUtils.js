const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const generateJWT = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });

const generateResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 3600000;
  return { token, expires };
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

module.exports = { generateJWT, generateResetToken, transporter };