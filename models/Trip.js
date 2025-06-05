const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  description: {
    overview: { type: String, required: true }, // Overview of the trip
    inclusions: { type: [String], required: true }, // List of items/services included
    exclusions: { type: [String], required: true }, // List of items/services not included
  }, // Structured description with detailed fields
  coverImage: { type: String },
  photos: { type: [String], default: [] }, // Photos for the location
  itinerary: [
    {
      order: { type: Number, required: true }, // Order of the stop in the itinerary
      location: { type: String, required: true }, // Location name
      days: { type: Number }, // Date of the visit
      startDate: { type: Date, required: true }, // Date of the visit
      endDate: { type: Date, required: true }, // Date of the visit
      notes: { type: String }, // Additional details or notes for the stop
      transportation: [{ type: String }], // Multiple transport modes (e.g., bus, train, flight)
      accommodation: { type: String }, // Details about accommodation
      geoLocation: { // Latitude & longitude
        lat: { type: Number },
        lng: { type: Number }
      },
      activities: [{ type: String }], // List of planned activities at the location
      costEstimate: { type: Number, default: 0 } // Estimated cost for this part of the trip
    }
  ],
  minParticipants: { type: Number, required: true },
  maxParticipants: { type: Number, required: true },
  currentParticipants: { type: Number },
  price: { type: Number, required: true }, // price per person
  tags: { type: [String], default: [] }, // Optional tags for categorization
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],  
  status: {
    type: String,
    enum: ['open', 'confirmed', 'full', 'inProgress', 'completed', 'cancelled'],
    default: 'open',
    required: true
  },
  privacy: {
    type: String,
    enum: ['public', 'private', 'unlisted'],
    default: 'public',
    required: true
  },
  cancellationPolicy: { type: String },
  bookingDeadline: { type: Date },
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Expense" }],
  chat: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
}, { timestamps: true });

module.exports = mongoose.model('Trip', tripSchema);
