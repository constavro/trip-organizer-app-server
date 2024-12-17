const Review = require('../models/Review');

// Middleware: Validate Review Input
const validateReviewInput = (req, res, next) => {
    const { tripId, bookingId, rating } = req.body;
    if (!tripId || !bookingId || !rating) {
      return sendError(res, 400, 'Trip ID, Booking ID, and Rating are required');
    }
    next();
  };
  
// Middleware: Check Existing Review
const checkExistingReview = async (req, res, next) => {
    const { tripId } = req.body;
    try {
      const existingReview = await Review.findOne({ user: req.user.id, trip: tripId });
      if (existingReview) {
        return sendError(res, 400, 'You have already reviewed this trip');
      }
      next();
    } catch (err) {
      console.error(err);
      sendError(res, 500, 'Server error while checking existing reviews', err.message);
    }
  };

  module.exports = { validateReviewInput, checkExistingReview};