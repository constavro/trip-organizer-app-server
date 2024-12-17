// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  pricePaid: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled', 'completed'], default: 'pending' },
  paymentReference: { type: String }, // Optional field for payment tracking
}, { timestamps: true });

bookingSchema.index({ user: 1, trip: 1 }, { unique: true }); // Ensure one booking per user-trip combination

module.exports = mongoose.model('Booking', bookingSchema);