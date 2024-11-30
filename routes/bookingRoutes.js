// routes/bookingRoutes.js
const express = require('express');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Create a new booking
router.post('/', authMiddleware, async (req, res) => {
  const { tripId, numberOfPeople } = req.body;
  const { userId } = req.user.id;
  console.log(req.user.id)
  console.log(tripId, numberOfPeople)


  try {
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const totalPrice = trip.price * numberOfPeople;

    const booking = new Booking({
      user: req.user.id,
      trip: tripId,
      numberOfPeople,
      totalPrice,
      status: 'pending'
    });

    await booking.save();
    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Error creating booking', error: err.message });
  }
});

// Get bookings for a host to review (pending bookings)
router.get('/host/:hostId', authMiddleware, async (req, res) => {

  try {
    const trips = await Trip.find({ host: req.user.id });
    const tripIds = trips.map(trip => trip._id);
    
    const bookings = await Booking.find({ trip: { $in: tripIds }, status: 'pending' }).populate('user trip');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching bookings', error: err.message });
  }
});

// Accept or decline a booking
router.put('/:bookingId', async (req, res) => {
  const { bookingId } = req.params;
  const { status } = req.body;

  if (!['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    booking.status = status;
    await booking.save();

    res.json({ message: `Booking has been ${status}.`, booking });
  } catch (err) {
    res.status(500).json({ message: 'Error updating booking', error: err.message });
  }
});

// Get bookings by user ID
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const bookings = await Booking.find({ user: userId }).populate('trip');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching bookings', error: err.message });
  }
});

module.exports = router;