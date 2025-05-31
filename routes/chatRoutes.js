// In your backend server file (e.g., messagesRoutes.js)

const express = require('express');
const Message = require('../models/Message');  // Assuming you have a Message model
const router = express.Router();

// Route to get all messages for a specific trip
router.get('/user/:tripId', async (req, res) => {
  try {
    const messages = await Message.find({ trip: req.params.tripId }).populate('sender', 'firstName lastName');
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages', error: err.message });
  }
});

// routes/messageRoutes.js
const Trip = require('../models/Trip');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/user', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all trips the user participates in
    const trips = await Trip.find({
      $or: [
        { participants: userId },
        { organizer: userId }
      ]
    }).select('_id title');
    

    const chats = await Promise.all(trips.map(async (trip) => {
      const lastMessage = await Message.findOne({ trip: trip._id })
        .populate('sender', 'firstName lastName')
        .sort({ timestamp: -1 });

    console.log(lastMessage)

      return {
        tripId: trip._id,
        tripTitle: trip.title,
        lastMessage: lastMessage
          ? {
              text: lastMessage.content,
              senderName: `${lastMessage.sender?.firstName ?? 'Unknown'}`,
              time: lastMessage.timestamp,
            }
          : null,
      };
    }));

    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user chats', error: err.message });
  }
});

module.exports = router;
