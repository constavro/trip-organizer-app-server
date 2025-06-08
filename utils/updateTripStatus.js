const Trip = require('../models/Trip');

const updateTripStatus = async () => {
  const now = new Date();

  // Set trips to 'inProgress' if startDate <= now and not already completed or cancelled
  await Trip.updateMany(
    {
      startDate: { $lte: now },
      endDate: { $gte: now },
      status: { $nin: ['inProgress', 'completed', 'cancelled'] },
    },
    { $set: { status: 'inProgress' } }
  );

  // Set trips to 'completed' if endDate < now
  await Trip.updateMany(
    {
      endDate: { $lt: now },
      status: { $nin: ['completed', 'cancelled'] },
    },
    { $set: { status: 'completed' } }
  );

  return { message: 'Trip statuses updated based on dates.' };
};

module.exports = { updateTripStatus };
