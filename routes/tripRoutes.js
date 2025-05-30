const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const authMiddleware = require('../middleware/authMiddleware');
const validateOwnership = require('../middleware/tripMiddleware');
const { sendError, getPagination, generateAITrip } = require('../utils/tripUtils');

// ======================== ROUTES ==========================

// GET: All trips with pagination and filters
router.get('/', async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { tags, minPrice, maxPrice } = req.query;

  try {
    const filter = {};
    if (tags) filter.tags = { $in: tags.split(',') };
    if (minPrice) filter.price = { $gte: parseInt(minPrice) };
    if (maxPrice) filter.price = { ...filter.price, $lte: parseInt(maxPrice) };

    const [trips, totalTrips] = await Promise.all([
      Trip.find(filter)
        .populate('organizer', 'firstName lastName')
        .limit(limit)
        .skip(skip),
      Trip.countDocuments(filter),
    ]);

    res.status(200).json({
      trips,
      pagination: {
        totalTrips,
        currentPage: page,
        totalPages: Math.ceil(totalTrips / limit),
        limit,
      },
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 500, 'Error fetching trips', err.message);
  }
});

// GET: Trip details by ID
router.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
  .populate('organizer', 'firstName lastName')
  .populate({
    path: 'participants',
    select: 'firstName lastName profilePicture'
  });
    if (!trip) return sendError(res, 404, 'Trip not found');

    res.status(200).json(trip);
  } catch (err) {
    console.error(err.message);
    sendError(res, 500, 'Error fetching trip details', err.message);
  }
});


// POST: Create a new trip (Protected)
// POST: Create a new trip (Protected)
router.post('/', authMiddleware, async (req, res) => {
  const {
    title,
    startDate,
    endDate,
    description,
    itinerary,
    minParticipants,
    maxParticipants,
    price,
    tags = [],
  } = req.body;

  // Validate required fields
  if (!title || !startDate || !endDate || !description || !itinerary?.length || !minParticipants || !maxParticipants || !price) {
    return sendError(res, 400, 'All required fields must be provided');
  }

  // Validate itinerary structure
  const isValidItinerary = itinerary.every(({ order, location, startDate, endDate, costEstimate }) => {
    return (
      typeof order === 'number' &&
      typeof location === 'string' &&
      typeof startDate === 'string' && !isNaN(Date.parse(startDate)) && // Ensure startDate is a valid date string
      typeof endDate === 'string' && !isNaN(Date.parse(endDate)) && // Ensure endDate is a valid date string
      // geoLocation && typeof geoLocation.lat === 'string' && !isNaN(parseFloat(geoLocation.lat)) &&
      // typeof geoLocation.lng === 'string' && !isNaN(parseFloat(geoLocation.lng)) &&
      (costEstimate === '' || typeof costEstimate === 'number') // Ensure costEstimate is a number or empty string
    );
  });

  if (!isValidItinerary) return sendError(res, 400, 'Invalid itinerary format');

  try {
    // Create new trip instance
    const newTrip = new Trip({
      organizer: req.user.id,
      title,
      startDate, // use startDate, instead of departureDate
      endDate, // use endDate
      description,
      itinerary,
      minParticipants,
      maxParticipants,
      price,
      tags,
    });

    // Save the new trip to the database
    const savedTrip = await newTrip.save();
    res.status(201).json(savedTrip);
  } catch (err) {
    console.error(err.message);
    sendError(res, 500, 'Error creating trip', err.message);
  }
});


// PUT: Update trip details
router.put('/:id', authMiddleware, validateOwnership, async (req, res) => {
  try {
    const updates = req.body;

    // Validate itinerary if updated
    if (updates.itinerary) {
      const isValidItinerary = updates.itinerary.every(({ order, location, nights, itineraryDescription, coordinates }) => {
        return (
          typeof order === 'number' &&
          typeof nights === 'number' &&
          typeof location === 'string' &&
          typeof itineraryDescription === 'string' &&
          (!coordinates || (typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number'))
        );
      });
      if (!isValidItinerary) return sendError(res, 400, 'Invalid itinerary format');
    }

    Object.assign(req.trip, updates); // Merge updates into the trip
    const updatedTrip = await req.trip.save();
    res.status(200).json({ message: 'Trip updated successfully', trip: updatedTrip });
  } catch (err) {
    console.error(err.message);
    sendError(res, 500, 'Error updating trip', err.message);
  }
});

// DELETE: Delete trip
router.delete('/:id', authMiddleware, validateOwnership, async (req, res) => {
  try {
    await req.trip.deleteOne();
    res.status(200).json({ message: 'Trip deleted successfully' });
  } catch (err) {
    console.error(err.message);
    sendError(res, 500, 'Error deleting trip', err.message);
  }
});

router.get('/:tripId/participants', authMiddleware, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId).populate('participants', 'firstName _id');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip.participants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/ai-trip', authMiddleware, async (req, res) => {
  const { startDate, endDate, area, participants } = req.body;

  const userid = req.user.id

  if (!startDate || !endDate || !area || !participants) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const aiTrip = await generateAITrip({ startDate, endDate, area, participants, userid });
    res.status(201).json(aiTrip);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to generate trip' });
  }
});


module.exports = router;