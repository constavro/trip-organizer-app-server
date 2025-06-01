// routes/chatRoutes.js
const express = require('express');
const mongoose = require('mongoose'); // Import mongoose for ObjectId validation
const Message = require('../models/Message');
const Trip = require('../models/Trip');
const authMiddleware = require('../middleware/authMiddleware'); // Assuming you have this
const router = express.Router();

// Route to get all messages for a specific trip (with pagination)
router.get('/trip/:tripId', authMiddleware, async (req, res) => { // Changed endpoint, added auth
  try {
    const { tripId } = req.params;
    const userId = req.user.id; // Get current user from auth middleware

    if (!mongoose.Types.ObjectId.isValid(tripId)) {
        return res.status(400).json({ message: 'Invalid Trip ID format' });
    }

    // Optional: Check if user is part of the trip before fetching messages
    const trip = await Trip.findOne({ _id: tripId, $or: [{ participants: userId }, { organizer: userId }] });
    if (!trip) {
        return res.status(403).json({ message: 'You are not authorized to view messages for this trip.' });
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30; // Number of messages per page
    const skip = (page - 1) * limit;

    const messages = await Message.find({ trip: tripId })
      .populate('sender', 'firstName lastName profilePhoto') // Added profilePhoto
      .sort({ createdAt: -1 }) // Fetch latest messages first for pagination
      .skip(skip)
      .limit(limit);

    // Reverse for chronological order on client-side if needed, or client handles display order
    res.json({ messages: messages.reverse() }); // Reverse back for display

  } catch (err) {
    console.error('Error fetching messages for trip:', err);
    res.status(500).json({ message: 'Error fetching messages', error: err.message });
  }
});

// Route to get all chat summaries for the logged-in user
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const userTrips = await Trip.find({
      $or: [
        { participants: userId },
        { organizer: userId }
      ]
    }).select('_id title coverPhoto'); // Added coverPhoto for better UI


    const chats = await Promise.all(userTrips.map(async (trip) => {
      const lastMessage = await Message.findOne({ trip: trip._id })
        .populate('sender', 'firstName lastName')
        .sort({ createdAt: -1 }); // Use createdAt from timestamps

      // Count unread messages for the current user in this trip
      const unreadCount = await Message.countDocuments({
        trip: trip._id,
        'readBy.user': { $ne: new mongoose.Types.ObjectId(userId) }, // Check if user is NOT in readBy
        sender: { $ne: new mongoose.Types.ObjectId(userId) } // Don't count user's own unread messages
      });

      return {
        tripId: trip._id,
        tripTitle: trip.title,
        tripCoverPhoto: trip.coverPhoto, // Send cover photo
        lastMessage: lastMessage
          ? {
              id: lastMessage._id,
              content: lastMessage.content,
              senderName: lastMessage.sender ? `${lastMessage.sender.firstName || 'User'}` : 'System',
              senderId: lastMessage.sender ? lastMessage.sender._id : null,
              timestamp: lastMessage.createdAt, // Use createdAt
              type: lastMessage.type,
            }
          : null,
        unreadCount: unreadCount,
      };
    }));

    // Sort chats by last message time (descending)
    chats.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1; // Chats with no messages at the end
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
    });

    res.json(chats);
  } catch (err) {
    console.error('Error fetching user chats:', err);
    res.status(500).json({ message: 'Error fetching user chats', error: err.message });
  }
});

module.exports = router;