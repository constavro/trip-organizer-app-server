const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // The user who wrote the review
  },
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true, // The trip being reviewed
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true, // The booking associated with the review
  },
  rating: {
    type: Number,
    required: true, // The rating provided by the user
    min: 1,
    max: 5, // Assuming a 1-5 rating scale
  },
  comment: {
    type: String,
    maxlength: 500, // Optional field for additional comments with a max length
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically sets the date when the review is created
  },
});

// const reviewSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
//   booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
//   rating: { type: Number, required: true, min: 1, max: 5 },
//   comment: { type: String, maxlength: 500 },
// }, { timestamps: true });

// reviewSchema.index({ user: 1, trip: 1 }, { unique: true }); // Ensure one review per user-trip combination

module.exports = mongoose.model('Review', reviewSchema);