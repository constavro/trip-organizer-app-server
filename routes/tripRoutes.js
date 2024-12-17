// const express = require('express');
// const router = express.Router();
// const Trip = require('../models/Trip');
// const authMiddleware = require('../middleware/authMiddleware');
// const validateOwnership = require('../middleware/tripMiddleware');
// const { sendError, getPagination } = require('../utils/tripUtils');

// // ======================== ROUTES ==========================

// // GET: All trips with pagination
// router.get('/', async (req, res) => {
//   const { page, limit, skip } = getPagination(req);

//   try {
//     const [trips, totalTrips] = await Promise.all([
//       Trip.find()
//         .populate('host', 'firstName lastName')
//         .limit(limit)
//         .skip(skip),
//       Trip.countDocuments(),
//     ]);

//     res.status(200).json({
//       trips,
//       pagination: {
//         totalTrips,
//         currentPage: page,
//         totalPages: Math.ceil(totalTrips / limit),
//         limit,
//       },
//     });
//   } catch (err) {
//     console.error(err.message);
//     sendError(res, 500, 'Error fetching trips', err.message);
//   }
// });

// // GET: Trip details by ID (Protected)
// router.get('/:id', authMiddleware, async (req, res) => {
//   try {
//     const trip = await Trip.findById(req.params.id).populate('host');
//     if (!trip) return sendError(res, 404, 'Trip not found');

//     res.status(200).json(trip);
//   } catch (err) {
//     console.error(err.message);
//     sendError(res, 500, 'Error fetching trip details', err.message);
//   }
// });

// // DELETE: Delete trip by ID (Protected)
// router.delete('/:id', authMiddleware, validateOwnership, async (req, res) => {
//   try {
//     await req.trip.deleteOne();
//     res.status(200).json({ message: 'Trip deleted successfully' });
//   } catch (err) {
//     console.error(err.message);
//     sendError(res, 500, 'Error deleting trip', err.message);
//   }
// });

// // POST: Create a new trip (Protected)
// router.post('/', authMiddleware, async (req, res) => {
//   const { title, departureDate, description, itinerary, minParticipants, maxParticipants, price } = req.body;

//   // Input Validation
//   if (!title || !departureDate || !description || !itinerary?.length || !minParticipants || !maxParticipants || !price) {
//     return sendError(res, 400, 'All required fields must be provided');
//   }

//   // Itinerary Validation
//   const isValidItinerary = itinerary.every(
//     ({ order, location, nights, itineraryDescription }) =>
//       typeof order === 'number' &&
//       typeof nights === 'number' &&
//       typeof location === 'string' &&
//       typeof itineraryDescription === 'string'
//   );

//   if (!isValidItinerary) return sendError(res, 400, 'Invalid itinerary format');

//   // Create Trip
//   const newTrip = new Trip({
//     host: req.user.id,
//     title,
//     departureDate,
//     description,
//     itinerary,
//     minParticipants,
//     maxParticipants,
//     price,
//   });

//   try {
//     const savedTrip = await newTrip.save();
//     res.status(201).json(savedTrip);
//   } catch (err) {
//     console.error(err.message);
//     sendError(res, 500, 'Error creating trip', err.message);
//   }
// });

// // PUT: Update trip by ID (Protected)
// router.put('/:id', authMiddleware, validateOwnership, async (req, res) => {
//   try {
//     Object.assign(req.trip, req.body); // Merge updates
//     const updatedTrip = await req.trip.save();
//     res.status(200).json({ message: 'Trip updated successfully', trip: updatedTrip });
//   } catch (err) {
//     console.error(err.message);
//     sendError(res, 500, 'Error updating trip', err.message);
//   }
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const authMiddleware = require('../middleware/authMiddleware');
const validateOwnership = require('../middleware/tripMiddleware');
const { sendError, getPagination } = require('../utils/tripUtils');

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
        .populate('host', 'firstName lastName')
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
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('host', 'firstName lastName');
    if (!trip) return sendError(res, 404, 'Trip not found');

    res.status(200).json(trip);
  } catch (err) {
    console.error(err.message);
    sendError(res, 500, 'Error fetching trip details', err.message);
  }
});

// POST: Create a new trip (Protected)
router.post('/', authMiddleware, async (req, res) => {
  const {
    title,
    departureDate,
    description,
    itinerary,
    minParticipants,
    maxParticipants,
    price,
    tags = [],
  } = req.body;

  // Validate required fields
  if (!title || !departureDate || !description || !itinerary?.length || !minParticipants || !maxParticipants || !price) {
    return sendError(res, 400, 'All required fields must be provided');
  }

  // Validate itinerary structure
  const isValidItinerary = itinerary.every(({ order, location, nights, itineraryDescription, coordinates }) => {
    return (
      typeof order === 'number' &&
      typeof nights === 'number' &&
      typeof location === 'string' &&
      typeof itineraryDescription === 'string' &&
      (!coordinates || (typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number'))
    );
  });

  if (!isValidItinerary) return sendError(res, 400, 'Invalid itinerary format');

  try {
    const newTrip = new Trip({
      host: req.user.id,
      title,
      departureDate,
      description,
      itinerary,
      minParticipants,
      maxParticipants,
      price,
      tags,
    });

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

module.exports = router;