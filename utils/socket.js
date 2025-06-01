// utils/socketHandler.js
const Message = require('../models/Message');
const User = require('../models/User'); // Not strictly needed here unless fetching more user details
const mongoose = require('mongoose');


function socketHandler(io) {
  io.on('connection', (socket) => {
    // console.log(`User connected: ${socket.id}`);
    // const userId = socket.handshake.query.userId; // If you pass userId on connection

    socket.on('joinRoom', (tripId) => {
      if (!tripId) {
        // console.log('Trip ID is required for joinRoom');
        socket.emit('socketError', { message: 'Trip ID is required to join room.' });
        return;
      }
      socket.join(tripId);
      // console.log(`User ${socket.id} joined room for trip ${tripId}`);
      // socket.emit('roomJoined', { tripId, message: `You have joined the room for trip ${tripId}` });
    });

    socket.on('leaveRoom', (tripId) => {
      if (tripId) {
        socket.leave(tripId);
        // console.log(`User ${socket.id} left room for trip ${tripId}`);
      }
    });

    socket.on('chatMessage', async ({ tripId, senderId, content, type = 'text', attachmentUrl = null }) => {
      if (!tripId || !senderId || !content) {
        socket.emit('socketError', { message: 'Missing data for chat message.'});
        return;
      }

      try {
        const message = new Message({
          trip: tripId,
          sender: senderId,
          content,
          type,
          attachmentUrl,
          readBy: [{ user: senderId, readAt: new Date() }], // Sender has "read" their own message
        });

        await message.save();

        // Populate sender details for the emitted message
        const populatedMessage = await Message.findById(message._id)
                                              .populate('sender', 'firstName lastName profilePhoto')
                                              .lean(); // Use .lean() for plain JS object

        io.to(tripId).emit('newMessage', populatedMessage);

        // Optional: notify users not in the room about a new message.
        // This might involve more complex logic to find participants not currently connected to this room.
        // For simplicity, focusing on in-room emission.

      } catch (error) {
        console.error('Error saving/sending message:', error);
        socket.emit('socketError', { message: 'Failed to send message.', error: error.message });
      }
    });

    socket.on('markMessagesAsRead', async ({ tripId, userId, messageIds }) => {
      if (!tripId || !userId || !Array.isArray(messageIds) || messageIds.length === 0) {
        // console.log('Invalid data for markMessagesAsRead');
        socket.emit('socketError', { message: 'Invalid data to mark messages as read.' });
        return;
      }
      try {
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const tripObjectId = new mongoose.Types.ObjectId(tripId);
        
        // Update messages where this user is not already in readBy.user
        const result = await Message.updateMany(
          { 
            _id: { $in: messageIds.map(id => new mongoose.Types.ObjectId(id)) },
            trip: tripObjectId,
            'readBy.user': { $ne: userObjectId } // Only update if user hasn't read it
          },
          { $addToSet: { readBy: { user: userObjectId, readAt: new Date() } } }
        );

        // console.log(`Marked ${result.modifiedCount} messages as read for user ${userId} in trip ${tripId}`);
        
        // Notify the user (and potentially others in the room) about the read receipts update
        // This allows other clients to update their UI if they show "read by X, Y"
        io.to(tripId).emit('messagesRead', { tripId, userId, messageIds, readAt: new Date() });

      } catch (error) {
        console.error('Error marking messages as read:', error);
        socket.emit('socketError', { message: 'Failed to mark messages as read.', error: error.message });
      }
    });

    socket.on('disconnect', () => {
      // console.log(`User disconnected: ${socket.id}`);
      // Auto-leave rooms is handled by socket.io itself if rooms are dynamic per socket
    });
  });
}

module.exports = socketHandler;