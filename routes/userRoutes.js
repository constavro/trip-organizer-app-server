// routes/userRoutes.js
const express = require('express');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const authMiddleware = require('../middleware/authMiddleware');
const { fetchUserProfile } = require('../utils/userUtils');
const authorizeUser = require('../middleware/userMiddleware');
const router = express.Router();
const bcrypt = require('bcryptjs');

const upload = require('../middleware/upload');

// Delete the user and their profile
router.delete('/:userId', authMiddleware, authorizeUser, async (req, res) => {
  const { userId } = req.params;

  try {
    // Delete the user from the User model
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'User deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
});

// Get the user profile, their created trips, and their bookings
router.get('/:userId', authMiddleware, async (req, res) => {

  const { userId } = req.params;
  
  try {
    const user = await fetchUserProfile(userId);

    // Fetch the user's created trips
    const createdTrips = await Trip.find({ organizer: userId });

    const bookings = await Booking.find({ userId });

    // Combine the user's data for viewing
    const userProfile = {
      user,
      createdTrips,
      bookings
    };

    res.status(200).json(userProfile);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ message: 'Error fetching profile', error: err.message });
  }
});

const fs = require('fs');
const path = require('path');

// Edit logged-in user's profile
router.put('/:userId', authMiddleware, authorizeUser, async (req, res) => {
  const { userId } = req.params;
  const profileUpdates = req.body;

  console.log('Incoming profile updates:', profileUpdates);

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Determine which photos to delete
    if (profileUpdates.photos && Array.isArray(profileUpdates.photos)) {
      const oldPhotos = user.photos || [];
      const newPhotos = profileUpdates.photos;

      const removedPhotos = oldPhotos.filter(oldPath => !newPhotos.includes(oldPath));

      removedPhotos.forEach((photoPath) => {
        const fullPath = path.join(__dirname, '..', photoPath);
        console.log(fullPath)
        fs.unlink(fullPath, (err) => {
          if (err) {
            console.error(`Failed to delete photo at ${fullPath}:`, err.message);
          } else {
            console.log(`Deleted photo: ${fullPath}`);
          }
        });
      });
    }

    // Update only the allowed profile fields
    const allowedFields = [
      'bio',
      'about',
      'profilePhoto',
      'spokenLanguages',
      'countriesVisited',
      'socialLinks',
      'photos',
    ];

    allowedFields.forEach((field) => {
      if (profileUpdates[field] !== undefined) {
        user[field] = profileUpdates[field];
      }
    });

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
});




router.post('/upload-photo', authMiddleware, upload.single('photo'), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const photoPath = `/uploads/users/${req.file.filename}`;

    console.log(photoPath); // Confirm the correct path

    res.status(200).json({ message: 'Photo uploaded', path: photoPath });
  } catch (err) {
    console.error('Error uploading photo:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/photos', authMiddleware, async (req, res) => {
  const { path: photoPath } = req.body;
  console.log("delete")

  try {
    const absolutePath = path.join(__dirname, '..', 'uploads', photoPath);
    fs.unlinkSync(absolutePath);

    res.status(200).json({ message: 'Photo deleted successfully', removedPath: photoPath });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ message: 'Failed to delete photo' });
  }
});


router.post('/upload-profile-photo', authMiddleware, upload.single('photo'), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const photoPath = `/uploads/users/${req.file.filename}`;

    console.log(photoPath)

    res.status(200).json({ message: 'Photo uploaded', path: photoPath });
  } catch (err) {
    console.error('Error uploading photo:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:userId/change-password', authMiddleware, authorizeUser, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.params.userId);

  if (!user) return res.status(404).json({ message: 'User not found' });

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Incorrect current password' });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.status(200).json({ message: 'Password updated successfully' });
});



module.exports = router;
