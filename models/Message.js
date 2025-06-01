// models/Message.js
const mongoose = require('mongoose');

const readReceiptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  readAt: { type: Date, default: Date.now }
}, { _id: false }); // No separate _id for subdocuments unless needed

const messageSchema = new mongoose.Schema({
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  type: {
      type: String,
      enum: ['text', 'image', 'file', 'system_notification'], // e.g., "User X joined the trip"
      default: 'text'
  },
  attachmentUrl: { type: String }, // URL if type is image/file
  readBy: [readReceiptSchema], // Array of users who have read it and when
  // 'timestamp' is covered by timestamps: true (createdAt)
}, { timestamps: true }); // Adds createdAt (for when message sent) and updatedAt

module.exports = mongoose.model('Message', messageSchema);