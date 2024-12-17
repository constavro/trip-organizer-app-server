const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { validateReviewInput, checkExistingReview } = require('../middleware/reviewMiddleware');
const sendError  = require('../utils/reviewUtils');
const Review = require('../models/Review');
const Booking = require('../models/Booking');

// ======================== ROUTES ==========================

// POST: Add a new review
router.post(
    '/',
    authMiddleware,
    validateReviewInput,
    checkExistingReview,
    async (req, res) => {
      const { tripId, bookingId, rating, comment } = req.body;
  
      try {
        // Ensure the booking exists and belongs to the user
        const booking = await Booking.findOne({ _id: bookingId, user: req.user.id });
        if (!booking) {
          return sendError(res, 403, 'Unauthorized to review this booking');
        }
  
        // Create and save the review
        const review = new Review({
          user: req.user.id,
          trip: tripId,
          booking: bookingId,
          rating,
          comment,
        });
  
        await review.save();
        res.status(201).json({ message: 'Review added successfully', review });
      } catch (err) {
        console.error(err);
        sendError(res, 500, 'Error adding review', err.message);
      }
    }
  );
  
  // GET: Get reviews for a specific trip
  router.get('/:tripId', async (req, res) => {
    const { tripId } = req.params;
  
    try {
      const reviews = await Review.find({ trip: tripId }).populate('user', 'firstName lastName');
      res.status(200).json({ reviews });
    } catch (err) {
      console.error(err);
      sendError(res, 500, 'Error fetching reviews', err.message);
    }
  });
  
  // DELETE: Delete a review (only by the user or admin)
  router.delete('/:reviewId', authMiddleware, async (req, res) => {
    const { reviewId } = req.params;
  
    try {
      // Fetch the review
      const review = await Review.findById(reviewId);
      if (!review) return sendError(res, 404, 'Review not found');
  
      // Check if user is owner or admin
      const isOwner = review.user.toString() === req.user.id;
      const isAdmin = req.user.role === 'admin'; // Assuming `role` is set in authMiddleware
  
      if (!isOwner && !isAdmin) {
        return sendError(res, 403, 'Unauthorized to delete this review');
      }
  
      await review.deleteOne();
      res.status(200).json({ message: 'Review deleted successfully' });
    } catch (err) {
      console.error(err);
      sendError(res, 500, 'Error deleting review', err.message);
    }
  });
  
  module.exports = router;