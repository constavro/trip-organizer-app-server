const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Profile = require('../models/Profile');
const router = express.Router();

// Environment Variables for Configuration
const { JWT_SECRET, SMTP_USER, SMTP_PASS, FRONTEND_URL, BACKEND_URL } = process.env;

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Utility Functions
const generateJWT = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '1h' });
};

// **Routes**

// Register a new user
router.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(409).json({ message: 'User already exists' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save the user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    // Create the user's profile
    const newProfile = new Profile({
      userId: newUser._id,
      bio: '',
      spokenLanguages: [],
      photos: [],
      about: '',
      countriesVisited: [],
    });
    await newProfile.save();

    // Send confirmation email
    const confirmationUrl = `${BACKEND_URL}/api/auth/confirm/${newUser._id}`;
    const mailOptions = {
      from: '"Your App Name" <no-reply@yourapp.com>',
      to: email,
      subject: 'Account Confirmation',
      html: `
        <h1>Welcome, ${firstName}!</h1>
        <p>Thank you for registering. Please confirm your account by clicking the link below:</p>
        <a href="${confirmationUrl}">Confirm Account</a>
      `,
    };

    await transporter.sendMail(mailOptions);

    const token = generateJWT(newUser._id);
    res.status(201).json({
      message: 'Registration successful. Please check your email to confirm your account.',
      token,
      user: { id: newUser._id, firstName, email },
      profile: newProfile,
    });
  } catch (error) {
    console.error('Error registering user:', error);
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

// Account confirmation route
router.get('/confirm/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isConfirmed) {
      return res.status(400).json({ message: 'Account already confirmed' });
    }

    user.isConfirmed = true;
    await user.save();

    // Redirect to a frontend page
    res.redirect(`${FRONTEND_URL}/email-confirmed`);
  } catch (error) {
    console.error('Error confirming account:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Middleware for JWT verification
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(403).json({ message: 'Access denied' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Protected route
router.get('/protected', authMiddleware, (req, res) => {
  res.status(200).json({ message: `Hello ${req.user.id}, this is a protected route` });
});

module.exports = router;