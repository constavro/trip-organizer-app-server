// routes/bookingRoutes.js
const express = require('express');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Create a new booking
router.post('/', authMiddleware, async (req, res) => {
  const { tripId } = req.body;
  const { id: userId } = req.user; // Extract user ID correctly from req.user
  
  try {
    // Find the trip by ID
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Calculate the total price for the booking
    const pricePaid = trip.price;

    // Create a new booking instance
    const booking = new Booking({
      user: userId,
      trip: tripId,
      pricePaid,
      status: 'pending' // Default status is 'pending', but explicitly set here for clarity
    });

    // Save the booking to the database
    await booking.save();

    // Return the created booking as a response
    res.status(201).json(booking);
  } catch (err) {
    // Handle any errors during the process
    res.status(500).json({ message: 'Error creating booking', error: err.message });
  }
});

router.get('/check/:tripId', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { tripId } = req.params;

  if (!tripId) {
    return res.status(400).json({ message: 'tripId is required' });
  }

  try {
    const existingBooking = await Booking.findOne({
      trip: tripId,
      user: userId,
      status: { $in: ['pending', 'cancelled'] },
    });

    if (existingBooking) {
      return res.status(200).json({ status: existingBooking.status });
    } else {
      return res.status(204).send(); // No existing booking
    }
  } catch (error) {
    console.error('Error checking booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get bookings for a host to review (pending bookings)
router.get('/host/:hostId', authMiddleware, async (req, res) => {

  try {
    const trips = await Trip.find({ organizer: req.user.id });
    const tripIds = trips.map(trip => trip._id);
    
    const bookings = await Booking.find({ trip: { $in: tripIds }, status: 'pending' }).populate('user trip');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching bookings', error: err.message });
  }
});

// Accept or decline a booking
router.put('/host/:bookingId', authMiddleware, async (req, res) => {

  const { bookingId } = req.params;
  const { status } = req.body;

  if (!['accepted', 'declined', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    booking.status = status;

    if (status === 'accepted') {

      console.log('accepted')

      const trip = await Trip.findById(booking.trip);

      console.log(trip)

      if (!trip) {
        return res.status(404).json({ message: 'Trip not found' });
      }

      const update = {
        $addToSet: { participants: booking.user },
        $inc: { currentParticipants: 1 }
      };

      if (trip.currentParticipants + 1 >= trip.maxParticipants) {
        update.$set = { status: 'full' };
      } else if (trip.currentParticipants + 1 >= trip.minParticipants) {
        update.$set = { status: 'confirmed' };
      }

      console.log(update)


      const updatedTrip = await Trip.findByIdAndUpdate(
        booking.trip,
        update,
        {
          new: true // Return the updated document
        }
      );

      console.log(updatedTrip)
    
      if (!updatedTrip) {
        return res.status(404).json({ message: 'Trip not found' });
      }
    
      // No need to call updatedTrip.save() after findByIdAndUpdate
    }
    

    await booking.save();


    res.json({ message: `Booking has been ${status}.`, booking });
  } catch (err) {
    res.status(500).json({ message: 'Error updating booking', error: err.message });
  }
});

router.put('/cancel/:tripId', authMiddleware, async (req, res) => {
  const { tripId } = req.params;

  try {
    const booking = await Booking.findOne({ trip: tripId, user: req.user.id });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking already cancelled' });
    }

    const trip = await Trip.findById(booking.trip);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Update the booking
    booking.status = 'cancelled';
    await booking.save();

    // Remove user from participants and decrement counter (min 0)
    const updatedTrip = await Trip.findByIdAndUpdate(
      booking.trip,
      {
        $pull: { participants: booking.user },
        $inc: { currentParticipants: -1 },
        $set: (trip.currentParticipants - 1) < trip.minParticipants
        ? { status: 'open' }
        : { status: 'confirmed' }
      },
      { new: true }
    );

    res.json({
      message: 'Booking cancelled and trip updated.',
      booking,
      trip: updatedTrip
    });
  } catch (err) {
    res.status(500).json({ message: 'Error cancelling booking', error: err.message });
  }
});

// Get bookings by user ID
router.get('/tripsbyuser', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Trips organized by the user
    const organized = await Trip.find({ organizer: userId });

    // Trips where the user is a participant (but not the organizer)
    const joined = await Trip.find({ 
      participants: userId,
      organizer: { $ne: userId } 
    });

    res.json({ organized, joined, totalPages: 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching trips', error: err.message });
  }
});

module.exports = router;