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
  const { page, limit: queryLimit, skip } = getPagination(req, { defaultLimit: 6 }); // Default limit for general list
  const {
    tags, // Comma-separated string
    minPrice,
    maxPrice,
    startDate, // ISO Date string
    endDate,   // ISO Date string
    status,    // Trip status
    search,    // Search query for title or location
    sort,      // Sort option (e.g., priceAsc, dateAsc)
    special,   // For special sections: 'lastSpot', 'confirmed', 'bookingSoon'
  } = req.query;

  try {
    const filter = {
      privacy: 'public',
      status: { $nin: ['inProgress', 'completed', 'cancelled'] }
    };
    

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { title: searchRegex },
        { "itinerary.location": searchRegex },
        // Add more fields to search if needed, e.g., description.overview
      ];
    }

    if (tags) filter.tags = { $in: tags.split(",") };
    if (minPrice) filter.price = { ...filter.price, $gte: parseInt(minPrice) };
    if (maxPrice) filter.price = { ...filter.price, $lte: parseInt(maxPrice) };

    if (startDate) filter.startDate = { ...filter.startDate, $gte: new Date(startDate) };
    if (endDate) filter.endDate = { ...filter.endDate, $lte: new Date(endDate) }; // This filters trips ENDING before this date.
                                                                                // If you want trips STARTING before this date, adjust accordingly.

    if (status) filter.status = status;

    let sortOption = {};
    if (sort) {
      switch (sort) {
        case "priceAsc":
          sortOption = { price: 1 };
          break;
        case "priceDesc":
          sortOption = { price: -1 };
          break;
        case "dateAsc": // Soonest departure
          sortOption = { startDate: 1 }; // Assuming startDate is the main departure date
          break;
        case "dateDesc": // Latest departure
          sortOption = { startDate: -1 };
          break;
        case "createdAtDesc": // Newest first
          sortOption = { createdAt: -1 };
          break;
        default:
          sortOption = { createdAt: -1 }; // Default sort
      }
    } else {
      sortOption = { createdAt: -1 }; // Default sort if none provided
    }

    let effectiveLimit = queryLimit;

    // Handle special sections
    if (special) {
      effectiveLimit = parseInt(req.query.previewLimit) || 3; // For preview sections, limit to a few items
      switch (special) {
        case "lastSpot":
          // Assumes currentParticipants is accurate.
          // This requires MongoDB 4.2+ for $expr in $match with $subtract in $elemMatch or complex aggregation.
          // A simpler way if your model has `availableSpots` field or if you can calculate it.
          // For now, let's use $expr. If currentParticipants is not on Trip directly, adjust.
          filter.$expr = {
            $eq: [1, { $subtract: ["$maxParticipants", "$currentParticipants"] }],
          };
          filter.status = { $in: ['open', 'confirmed'] }; // Only show for trips that can still be booked or are active
          break;
        case "confirmed":
          filter.status = "confirmed";
          break;
        case "bookingSoon":
          const today = new Date();
          const sevenDaysFromNow = new Date();
          sevenDaysFromNow.setDate(today.getDate() + 7);
          filter.bookingDeadline = { $gte: today, $lte: sevenDaysFromNow };
          filter.status = "open";
          // Optional: Sort by bookingDeadline ascending
          sortOption = { bookingDeadline: 1 };
          break;
        case "newlyAdded":
          // Already handled by default sort if no other sort is specified, or explicitly:
          sortOption = { createdAt: -1 };
          break;
        case "startingSoon":
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          filter.startDate = { $gte: new Date(), $lte: nextMonth };
          filter.status = { $in: ['open', 'confirmed'] };
          sortOption = { startDate: 1 };
          break;
      }
    }

    const [trips, totalTrips] = await Promise.all([
      Trip.find(filter)
        .populate("organizer", "firstName lastName")
        .sort(sortOption)
        .limit(effectiveLimit)
        .skip(special ? 0 : skip) // No skipping for special preview sections
        .lean(), // Use .lean() for better performance if you don't need Mongoose documents
      Trip.countDocuments(filter), // Count should reflect the main filter, not special section limits
    ]);

    res.status(200).json({
      trips,
      pagination: special ? null : { // No pagination for special sections
        totalItems: totalTrips,
        currentPage: page,
        totalPages: Math.ceil(totalTrips / queryLimit),
        limit: queryLimit,
      },
    });
  } catch (err) {
    console.error("Error fetching trips:", err.message);
    // sendError(res, 500, "Error fetching trips", err.message);
    res.status(500).json({ message: "Error fetching trips", error: err.message });
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
        let itemStartDate = null ,itemEndDate = null;
      
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
      itemStartDate = new Date(currentDate);
      itemEndDate = new Date(itemStartDate);
      itemEndDate.setDate(itemEndDate.getDate() + (item.days || 0) - 1); // 1-day item ends same day

      
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

router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );

    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
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
