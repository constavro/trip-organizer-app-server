const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Profile = require('../models/Profile');
const authMiddleware = require('../middleware/authMiddleware');
const { transporter, generateResetToken, generateJWT } = require('../utils/authUtils');
const router = express.Router();

// Environment Variables for Configuration
const { FRONTEND_URL, BACKEND_URL, JWT_SECRET } = process.env;

// **Routes**

// // Register a new user
router.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });
    await newUser.save();

    const newProfile = new Profile({
      userId: newUser._id,
      bio: '',
      spokenLanguages: [],
      photos: [],
      about: '',
      countriesVisited: [],
    });
    await newProfile.save();

    const confirmationToken = generateJWT(newUser._id);
    const confirmationUrl = `${BACKEND_URL}/api/auth/confirm/${confirmationToken}`;

    await transporter.sendMail({
      from: `"Your App Name" <no-reply@yourapp.com>`,
      to: email,
      subject: 'Account Confirmation',
      html: `
        <h1>Welcome, ${firstName}!</h1>
        <p>Click the link below to confirm your account:</p>
        <a href="${confirmationUrl}">Confirm Account</a>
      `,
    });

    res.status(201).json({
      message: 'Registration successful. Check your email to confirm your account.',
    });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Check if user is confirmed
    if (!user.isConfirmed) return res.status(403).json({ message: 'Please confirm your account first' });

    // Generate and send JWT
    const token = generateJWT(user._id);
    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user._id, firstName: user.firstName, email: user.email },
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/confirm/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isConfirmed) {
      return res.status(400).json({ message: 'Account already confirmed' });
    }

    user.isConfirmed = true;
    await user.save();

    res.redirect(`${FRONTEND_URL}/email-confirmed`);
  } catch (error) {
    console.error('Error confirming account:', error);
    res.status(400).json({ message: 'Invalid or expired confirmation link' });
  }
});

// Protected route
router.get('/protected', authMiddleware, (req, res) => {
  res.status(200).json({ message: `Hello ${req.user.id}, this is a protected route` });
});

router.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { token, expires } = generateResetToken();

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    const resetLink = `${FRONTEND_URL}/reset-password/${token}`;

    await transporter.sendMail({
      from: `"Your App Name" <no-reply@yourapp.com>`,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
      `,
    });

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;