const express = require('express');
const Trip = require('../models/Trip');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Get all trips with pagination
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Validate pagination parameters
  if (page < 1 || limit < 1) {
    return res.status(400).json({ message: 'Page and limit must be positive integers' });
  }

  const skipIndex = (page - 1) * limit;

  try {
    // Fetch trips with pagination and host details
    const [trips, totalTrips] = await Promise.all([
      Trip.find()
        .populate('host', 'firstName lastName') // Populating host with specific fields
        .limit(limit)
        .skip(skipIndex),
      Trip.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalTrips / limit);

    res.status(200).json({
      trips,
      pagination: {
        totalTrips,
        currentPage: page,
        totalPages,
        limit,
      },
    });
  } catch (err) {
    console.error('Error fetching trips:', err.message);
    res.status(500).json({ message: 'Error fetching trips', error: err.message });
  }
});
  
// Get trip details by ID
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const trip = await Trip.findById(id).populate('host'); // Populate host details (optional fields)
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    res.status(200).json(trip);
  } catch (err) {
    console.error('Error fetching trip details:', err.message);
    res.status(500).json({ message: 'Error fetching trip details', error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.host.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized to delete this trip' });
    }

    await Trip.findByIdAndDelete(id);
    res.status(200).json({ message: 'Trip deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


// Create a new trip (Protected route)
router.post('/', authMiddleware, async (req, res) => {
  const {
    title,
    departureDate,
    description: {
      overview,
      aboutYou,
      accommodation,
      inclusions,
      exclusions,
    } = {},
    itinerary = [],
    minParticipants,
    maxParticipants,
    price,
  } = req.body;

  console.log('Incoming data:', req.body);
  console.log('Host ID:', req.user.id);

  // Validate required fields
  if (
    !title ||
    !departureDate ||
    !overview ||
    !aboutYou ||
    !accommodation ||
    !Array.isArray(inclusions) ||
    !Array.isArray(exclusions) ||
    !itinerary.length ||
    !minParticipants ||
    !maxParticipants ||
    !price
  ) {
    return res
      .status(400)
      .json({ message: 'All required fields must be provided and valid' });
  }

  // Validate itinerary
  const isItineraryValid = itinerary.every(
    ({ order, location, nights, itineraryDescription }) =>
      order &&
      location &&
      nights &&
      itineraryDescription &&
      typeof order === 'number' &&
      typeof nights === 'number' &&
      typeof location === 'string' &&
      typeof itineraryDescription === 'string'
  );

  if (!isItineraryValid) {
    return res
      .status(400)
      .json({ message: 'Each itinerary item must have valid fields' });
  }

  // Create the new trip
  const trip = new Trip({
    host: req.user.id, // `req.user` populated by authMiddleware
    title,
    departureDate,
    description: {
      overview,
      aboutYou,
      accommodation,
      inclusions,
      exclusions,
    },
    itinerary,
    minParticipants,
    maxParticipants,
    price,
  });

  try {
    const savedTrip = await trip.save();
    res.status(201).json(savedTrip);
  } catch (err) {
    console.error('Error saving trip:', err.message);
    res.status(500).json({ message: 'Error creating trip', error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  console.log( id, userId)

  try {
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.host.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized to update this trip' });
    }

    const updates = req.body;
    Object.assign(trip, updates); // Update trip with new details
    await trip.save();
    res.status(200).json({ message: 'Trip updated successfully', trip });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;