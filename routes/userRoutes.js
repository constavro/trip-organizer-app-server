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
const upload = require('../middleware/upload'); // Multer middleware
const { uploadFileToBlob, deleteBlob, getBlobNameFromUrl } = require('../utils/azureBlobService'); // Azure service
const path = require('path'); // path is still used for generating blob names if needed, fs is removed as it's not used for file system operations for user photos.

// Delete the user and their profile
router.delete('/delete-user/:userId', authMiddleware, authorizeUser, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user's photos from Azure Blob Storage
    const photosToDelete = [];
    if (user.profilePhoto) {
      photosToDelete.push(user.profilePhoto);
    }
    if (user.photos && user.photos.length > 0) {
      photosToDelete.push(...user.photos);
    }

    for (const photoUrl of photosToDelete) {
      const blobName = getBlobNameFromUrl(photoUrl);
      if (blobName) {
        try {
          await deleteBlob(blobName);
        } catch (deleteError) {
          // Log error but continue, so user deletion is not blocked by a single photo deletion failure
          console.error(`Failed to delete photo ${blobName} from Azure:`, deleteError.message);
        }
      }
    }
    
    // Delete the user from the User model
    await User.findByIdAndDelete(userId);

    // Optionally, delete other related data like bookings, trips, etc. if needed.

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

    const createdTrips = await Trip.find({ organizer: userId });
    const bookings = await Booking.find({ userId });

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

// Edit logged-in user's profile
router.put('/:userId', authMiddleware, authorizeUser, async (req, res) => {
  const { userId } = req.params;
  const profileUpdates = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Handle photo deletions if photos array is explicitly managed
    if (profileUpdates.photos !== undefined && Array.isArray(profileUpdates.photos)) {
      const oldPhotos = user.photos || [];
      const newPhotos = profileUpdates.photos; // These are expected to be Azure URLs

      const removedPhotoUrls = oldPhotos.filter(oldUrl => !newPhotos.includes(oldUrl));

      for (const photoUrl of removedPhotoUrls) {
        const blobName = getBlobNameFromUrl(photoUrl);
        if (blobName) {
          try {
            await deleteBlob(blobName);
          } catch (deleteError) {
            console.error(`Failed to delete photo ${blobName} from Azure:`, deleteError.message);
            // Decide if you want to stop the update or just log the error
          }
        }
      }
    }
    
    // If profilePhoto is being changed and there was an old one
    if (profileUpdates.profilePhoto !== undefined && user.profilePhoto && user.profilePhoto !== profileUpdates.profilePhoto) {
        const oldProfilePhotoBlobName = getBlobNameFromUrl(user.profilePhoto);
        if (oldProfilePhotoBlobName) {
            try {
                await deleteBlob(oldProfilePhotoBlobName);
            } catch (deleteError) {
                console.error(`Failed to delete old profile photo ${oldProfilePhotoBlobName} from Azure:`, deleteError.message);
            }
        }
    }


    const allowedFields = [
      'bio',
      'about',
      'profilePhoto', // This will now be an Azure Blob URL
      'spokenLanguages',
      'countriesVisited',
      'socialLinks',
      'photos', // This will now be an array of Azure Blob URLs
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

// Generic photo upload (e.g., for user's photo gallery)
router.post('/upload-photo', authMiddleware, upload.single('photo'), async (req, res) => {
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const originalName = req.file.originalname;
    const extension = path.extname(originalName);
    // Blob name includes a path-like structure for organization
    const blobName = `users/${req.user.id}/${Date.now()}-${path.basename(originalName, extension)}${extension}`;
    
    const photoUrl = await uploadFileToBlob(req.file.buffer, blobName, req.file.mimetype);

    res.status(200).json({ message: 'Photo uploaded', path: photoUrl });
  } catch (err) {
    console.error('Error uploading photo to Azure:', err);
    res.status(500).json({ error: 'Failed to upload photo', details: err.message });
  }
});

// Upload profile photo
router.post('/upload-profile-photo', authMiddleware, upload.single('photo'), async (req, res) => {
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const originalName = req.file.originalname;
    const extension = path.extname(originalName);
    const blobName = `users/${req.user.id}/profile/${Date.now()}-${path.basename(originalName, extension)}${extension}`;
    
    const photoUrl = await uploadFileToBlob(req.file.buffer, blobName, req.file.mimetype);

    // Optionally: if an old profile photo exists, delete it from Azure.
    // This depends on your logic: do you update user.profilePhoto here or just return the URL?
    // Assuming this endpoint just uploads and returns the URL, and the PUT /:userId handles updating user.profilePhoto and deleting old one.
    
    res.status(200).json({ message: 'Profile photo uploaded', path: photoUrl });
  } catch (err) {
    console.error('Error uploading profile photo to Azure:', err);
    res.status(500).json({ error: 'Failed to upload profile photo', details: err.message });
  }
});

// Delete a specific photo (e.g., from user's photo gallery)
router.delete('/delete-photos', authMiddleware, async (req, res) => {
  const { photoUrl } = req.body; // Expecting the full Azure Blob URL

  if (!photoUrl) {
    return res.status(400).json({ message: 'Photo URL is required' });
  }

  try {
    const blobName = getBlobNameFromUrl(photoUrl);
    if (!blobName) {
      return res.status(400).json({ message: 'Invalid photo URL provided' });
    }

    // Optional: Check if the photo belongs to the user making the request.
    // This would require knowing how photos are associated with users in your DB (e.g. User.photos array).
    // For example:
    // const user = await User.findById(req.user.id);
    // if (!user.photos.includes(photoUrl) && user.profilePhoto !== photoUrl) {
    //   return res.status(403).json({ message: "You are not authorized to delete this photo." });
    // }

    await deleteBlob(blobName);

    // After deleting from Azure, you might need to update the user's document
    // if this photoUrl was stored in user.photos or user.profilePhoto.
    // This endpoint currently only deletes from Azure. The profile update (PUT /:userId)
    // is responsible for updating the User document.
    // If this endpoint is meant to be a standalone "delete this photo from my profile",
    // then it should also update the User document.
    // For now, it just deletes the blob. The frontend will likely trigger a profile update afterwards.

    res.status(200).json({ message: 'Photo deleted successfully from Azure', removedPath: photoUrl });
  } catch (err) {
    console.error('Error deleting photo from Azure:', err);
    res.status(500).json({ message: 'Failed to delete photo from Azure', error: err.message });
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