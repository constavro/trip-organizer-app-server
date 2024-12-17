// routes/userRoutes.js
const express = require('express');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const authMiddleware = require('../middleware/authMiddleware');
const { fetchUserProfile } = require('../utils/userUtils');
const authorizeUser = require('../middleware/userMiddleware');
const router = express.Router();

// Delete the user and their profile
router.delete('/:userId', authMiddleware, authorizeUser, async (req, res) => {
  const { userId } = req.params;

  try {
    // Delete the user's profile
    const profile = await Profile.findOneAndDelete({ userId });
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Delete the user from the User model
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'User and profile deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting user and profile:', err);
    res.status(500).json({ message: 'Error deleting user and profile', error: err.message });
  }
});

// Get the user profile, their created trips, and their bookings
router.get('/:userId', authMiddleware, async (req, res) => {

  const { userId } = req.params;
  
  try {
    const { user, profile } = await fetchUserProfile(userId);

    // Fetch the user's created trips
    const createdTrips = await Trip.find({ host: userId });

    const bookings = await Booking.find({ userId });

    // Combine the user's data for viewing
    const userProfile = {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      profile,
      createdTrips,
      bookings
    };

    res.status(200).json(userProfile);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ message: 'Error fetching profile', error: err.message });
  }
});

// Edit logged-in user's profile
router.put('/:userId', authMiddleware, authorizeUser, async (req, res) => {
  const { userId } = req.params
  const { ...profileUpdates } = req.body; // Separate user and profile fields

  try {
    const user = await User.findById(userId)

    // Update the Profile model for other fields
    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: profileUpdates },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Combine user and profile data in the response
    res.status(200).json({
      message: 'Profile updated successfully',
      user,
      profile,
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
});

// Edit logged-in user's personal info
router.get('/personal-info/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;

  try {
    // Ensure only the logged-in user can edit their own profile
    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'You can only edit your own profile' });
    }

    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Combine user and profile data in the response
    res.status(200).json({
      message: 'Personal information updated successfully',
      user
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Error fetching user', error: err.message });
  }
});

// Edit logged-in user's personal info
router.put('/personal-info/:userId', authMiddleware, authorizeUser, async (req, res) => {
  const { userId } = req.params;
  const { ...personalInfoUpdates } = req.body; // Separate user and profile fields

  try {

    // Update the User model for other fields
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: personalInfoUpdates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Combine user and profile data in the response
    res.status(200).json({
      message: 'Personal information updated successfully',
      user
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
});


module.exports = router;
