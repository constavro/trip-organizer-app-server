const express = require("express");
const router = express.Router();
const Trip = require("../models/Trip");
const authMiddleware = require("../middleware/authMiddleware");
const validateOwnership = require("../middleware/tripMiddleware");
const {
  sendError,
  getPagination,
  generateAITrip,
} = require("../utils/tripUtils");

const OPENCAGE_API_KEY = "326c5582aa4f4768a94cb809b894f1ff"

// ======================== ROUTES ==========================

// GET: All trips with pagination and filters
router.get("/", async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { tags, minPrice, maxPrice } = req.query;

  try {
    const filter = {};
    if (tags) filter.tags = { $in: tags.split(",") };
    if (minPrice) filter.price = { $gte: parseInt(minPrice) };
    if (maxPrice) filter.price = { ...filter.price, $lte: parseInt(maxPrice) };
    filter.privacy = 'public';

    const [trips, totalTrips] = await Promise.all([
      Trip.find(filter)
        .populate("organizer", "firstName lastName")
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
    sendError(res, 500, "Error fetching trips", err.message);
  }
});

// GET: Trip details by ID
router.get("/:id", async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate("organizer", "firstName lastName")
      .populate({
        path: "participants",
        select: "firstName lastName profilePicture",
      });
    if (!trip) return sendError(res, 404, "Trip not found");

    res.status(200).json(trip);
  } catch (err) {
    console.error(err.message);
    sendError(res, 500, "Error fetching trip details", err.message);
  }
});

// POST: Create a new trip (Protected)
router.post("/", authMiddleware, async (req, res) => {
  let {
    title,
    startDate,
    endDate,
    description,
    itinerary,
    minParticipants,
    maxParticipants,
    price,
    tags = [],
    isParticipating,
    privacy,
  } = req.body;


  // Validate required fields
  if (
    !title ||
    !startDate ||
    !endDate ||
    !description ||
    !itinerary?.length ||
    !minParticipants ||
    !maxParticipants ||
    !price
  ) {
    return sendError(res, 400, "All required fields must be provided");
  }

  // Validate itinerary structure
  const isValidItinerary = itinerary.every(
    ({ order, location, costEstimate }) => {
      return (
        typeof order === "number" &&
        typeof location === "string" &&
        (costEstimate === "" || typeof costEstimate === "number")
      );
    }
  );

  if (!isValidItinerary) {
    return sendError(res, 400, "Invalid itinerary format");
  }

  // Calculate start and end dates for each itinerary item
  let currentDate = new Date(startDate);

itinerary = await Promise.all(itinerary.map(async (item) => {
  // Geocode the location

  let geoLocation = item.geoLocation || null;

// Only fetch if lat or lng is missing
if (!geoLocation || geoLocation.lat == '' || geoLocation.lng == '') {
  try {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(item.location)}&key=${OPENCAGE_API_KEY}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.results && data.results.length > 0) {
      const coords = data.results[0].geometry;
      geoLocation = { lat: coords.lat, lng: coords.lng };
    }
  } catch (geoErr) {
    console.warn(
      `Geocoding failed for location "${item.location}":`,
      geoErr.message
    );
    geoLocation = null;
  }
}


  // Calculate start and end dates
  const itemStartDate = new Date(currentDate);
  const itemEndDate = new Date(itemStartDate);
  itemEndDate.setDate(itemEndDate.getDate() + (item.days || 0) - 1); // 1-day item ends same day

  // Prepare updated item
  const updatedItem = {
    ...item,
    startDate: itemStartDate,
    endDate: itemEndDate,
    geoLocation, // ✅ Include the geolocation result
  };

  // Update currentDate to the next day after this item's end
  currentDate = new Date(itemEndDate);
  currentDate.setDate(currentDate.getDate() + 1);

  return updatedItem;
}));


  // Set final trip endDate from the last itinerary item
  const computedStartDate = itinerary[0]?.startDate;
  const computedEndDate = itinerary[itinerary.length - 1]?.endDate;

  try {
    const newTrip = new Trip({
      organizer: req.user.id,
      title: title,
      startDate: computedStartDate,
      endDate: computedEndDate,
      description: description,
      itinerary: itinerary,
      minParticipants: minParticipants,
      maxParticipants: maxParticipants,
      price: price,
      tags: tags,
      participants: isParticipating === 'yes' ? [req.user.id] : [],
      currentParticipants: isParticipating === 'yes' ? 1 : 0,
      privacy: privacy,
    });

    const savedTrip = await newTrip.save();
    res.status(201).json(savedTrip);
  } catch (err) {
    console.error(err.message);
    sendError(res, 500, "Error creating trip", err.message);
  }
});

// PUT: Update trip details
// // Helper to calculate stop end date (ensure it's UTC-aware)
// const calculateStopEndDate = (startDateStr, numDays) => {
//   if (!startDateStr || isNaN(parseInt(numDays)) || parseInt(numDays) < 1) return null; // Or throw error
//   const date = new Date(startDateStr); // Assume startDateStr is already a Date object or valid ISO string
//   date.setUTCDate(date.getUTCDate() + parseInt(numDays) - 1);
//   return date;
// };

// // Helper to get the next day (UTC-aware)
// const getNextDay = (date) => {
//   if (!date) return null;
//   const next = new Date(date);
//   next.setUTCDate(next.getUTCDate() + 1);
//   return next;
// };



// PUT /api/trips/:tripId - Update a trip
router.put('/:tripId', authMiddleware, async (req, res) => {
try {
  const { tripId } = req.params;
  const updates = req.body;

  const trip = await Trip.findById(tripId);

  if (!trip) {
    return res.status(404).json({ message: 'Trip not found' });
  }

  // Authorization: Ensure the user is the organizer
  if (trip.organizer.toString() !== req.user.id) {
    return res.status(403).json({ message: 'User not authorized to update this trip' });
  }

  // Handle basic field updates
  Object.keys(updates).forEach(key => {
    if (key !== 'itinerary' && key !== '_id' && key !== 'organizer' && key !== 'participants' && key !== 'expenses' && key !== 'chat' && key !== 'createdAt' && key !== 'updatedAt') {
      if (typeof updates[key] === 'object' && !Array.isArray(updates[key]) && updates[key] !== null && trip[key]) {
        // For nested objects like description
        trip[key] = { ...trip[key], ...updates[key] };
      } else {
        trip[key] = updates[key];
      }
    }
  });
  
  // Convert main trip dates from string to Date objects if they are strings
  if (updates.startDate) trip.startDate = new Date(updates.startDate);
  if (updates.endDate) trip.endDate = new Date(updates.endDate);
  if (updates.bookingDeadline) trip.bookingDeadline = new Date(updates.bookingDeadline);
  else if (updates.bookingDeadline === '' || updates.bookingDeadline === null) trip.bookingDeadline = null;


  // Recalculate and validate itinerary if provided and trip dates are valid
  if (updates.itinerary && Array.isArray(updates.itinerary) && trip.startDate && trip.endDate) {

      // Calculate start and end dates for each itinerary item
      let currentDate = new Date(updates.startDate);
      const sortedItinerary = [...updates.itinerary].sort((a, b) => a.index - b.index);

      newItinerary = await Promise.all(sortedItinerary.map(async (item) => {
        // Geocode the location
      
        let geoLocation = item.geoLocation || null;
        let itemStartDate,itemEndDate;
      
      // Only fetch if lat or lng is missing
      if (!geoLocation || geoLocation.lat == '' || geoLocation.lng == '') {
        try {
          const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(item.location)}&key=${OPENCAGE_API_KEY}&limit=1`;
          const response = await fetch(url);
          const data = await response.json();
      
          if (data && data.results && data.results.length > 0) {
            const coords = data.results[0].geometry;
            geoLocation = { lat: coords.lat, lng: coords.lng };
          }

          // Calculate start and end dates
          itemStartDate = new Date(currentDate);
          itemEndDate = new Date(itemStartDate);
          itemEndDate.setDate(itemEndDate.getDate() + (item.days || 0) - 1); // 1-day item ends same day


        } catch (geoErr) {
          console.warn(
            `Geocoding failed for location "${item.location}":`,
            geoErr.message
          );
          geoLocation = null;
        }
      }
      
        // Prepare updated item
        const updatedItem = {
          ...item,
          startDate:itemStartDate,
          endDate:itemEndDate,
          geoLocation, // ✅ Include the geolocation result
        };
      
        // Update currentDate to the next day after this item's end
        currentDate = new Date(itemEndDate);
        currentDate.setDate(currentDate.getDate() + 1);
      
        return updatedItem;
      }

    ));


    trip.itinerary = newItinerary;

  } else if (updates.itinerary && updates.itinerary.length === 0) {
      trip.itinerary = []; // Allow clearing itinerary
  }

  if (updates.currentParticipants === updates.maxParticipants) {
    trip.status = "full"
  } else if (updates.currentParticipants >= updates.minParticipants) {
    trip.status = 'confirmed';
  } else {
    trip.status = 'open';
  }


  const updatedTrip = await trip.save();
  res.json(updatedTrip);

} catch (error) {
  console.error('Error updating trip:', error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: 'Validation Error', errors: error.errors });
  }
  res.status(500).json({ message: 'Server error while updating trip', error: error.message });
}
});

// DELETE: Delete trip
router.delete("/:id", authMiddleware, validateOwnership, async (req, res) => {
  try {
    await req.trip.deleteOne();
    res.status(200).json({ message: "Trip deleted successfully" });
  } catch (err) {
    console.error(err.message);
    sendError(res, 500, "Error deleting trip", err.message);
  }
});

router.get("/:tripId/participants", authMiddleware, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId).populate(
      "participants",
      "firstName _id"
    );
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    res.json(trip.participants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/ai-trip", authMiddleware, async (req, res) => {
  const { startDate, endDate, area, participants } = req.body;

  const userid = req.user.id;

  if (!startDate || !endDate || !area || !participants) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const aiTrip = await generateAITrip({
      startDate,
      endDate,
      area,
      participants,
      userid,
    });
    res.status(201).json(aiTrip);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate trip" });
  }
});

module.exports = router;
