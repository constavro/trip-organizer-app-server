const Trip = require('../models/Trip');
const Message = require('../models/Message');
const User = require('../models/User');

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Keep track of which trip room the socket is in
    let currentTripId = null;

    // Listen for the 'joinRoom' event and handle joining the correct trip room
    socket.on('joinRoom', (tripId) => {
      if (!tripId) {
        console.log('Trip ID is required');
        return;
      }

      currentTripId = tripId;
      socket.join(tripId);
      console.log(`User ${socket.id} joined room for trip ${tripId}`);
      socket.emit('roomJoined', `You have joined the room for trip ${tripId}`);
    });

    // Handle sending a message
    socket.on('chatMessage', async ({ tripId, senderId, content }) => {
      try {
        // Save the message with sender marked as having read it
        const message = new Message({
          trip: tripId,
          sender: senderId,
          content,
          readBy: [senderId], // Track who has read the message
        });

        await message.save();

        const populatedMessage = await message.populate('sender', 'firstName lastName profilePicture');

        // Emit the message to all clients in the room (except the sender)
        io.to(tripId).emit('newMessage', populatedMessage);

        // Optionally: notify other clients (outside the room) that a new message arrived
        // (For example, you could emit 'messageNotification' with minimal info)
        socket.broadcast.emit('messageNotification', {
          tripId,
          messageId: message._id,
          preview: content.slice(0, 100),
        });
      } catch (error) {
        console.error('Error sending message:', error.message);
      }
    });

    // Optional: Mark messages as read (called by frontend when user views the chat)
    socket.on('markMessagesAsRead', async ({ tripId, userId }) => {
      try {
        await Message.updateMany(
          { trip: tripId, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
      } catch (error) {
        console.error('Error marking messages as read:', error.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      socket.leave(currentTripId);
    });
  });
}

module.exports = socketHandler;
