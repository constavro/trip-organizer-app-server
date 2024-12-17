const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Environment Variables for Configuration
const { JWT_SECRET } = process.env;

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ message: 'Access denied, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user; // Attach the full user object to the request
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(400).json({ message: 'Invalid token' });
    } else {
      return res.status(500).json({ message: 'Authentication failed' });
    }
  }
};

module.exports = authMiddleware;