const Trip = require('../models/Trip');

// Middleware: Validate Trip Ownership
const validateOwnership = async (req, res, next) => {
    try {
      const trip = await Trip.findById(req.params.id);
      if (!trip) return sendError(res, 404, 'Trip not found');
  
      if (trip.host.toString() !== req.user.id)
        return sendError(res, 403, 'Unauthorized to modify this trip');
  
      req.trip = trip; // Attach trip to request for further use
      next();
    } catch (err) {
      console.error(err.message);
      sendError(res, 500, 'Server error', err.message);
    }
  };

  module.exports = validateOwnership;