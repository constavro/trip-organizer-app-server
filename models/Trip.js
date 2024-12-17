const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  departureDate: { type: Date, required: true },
  description: {
    overview: { type: String, required: true }, // Overview of the trip
    aboutYou: { type: String, required: true }, // Information about the host
    accommodation: { type: String, required: true }, // Details about accommodation
    inclusions: { type: [String], required: true }, // List of items/services included
    exclusions: { type: [String], required: true }, // List of items/services not included
  }, // Structured description with detailed fields
  itinerary: [
    {
      order: { type: Number, required: true }, // Order of the stop in the itinerary
      location: { type: String, required: true }, // Location name
      nights: { type: Number, required: true }, // Number of nights at the location
      photos: { type: [String], default: [] }, // Photos for the location
      itineraryDescription: { type: String, required: true }, // Additional details about the place
      transportation: { type: String }, // Mode of transport (e.g., bus, train, flight)
      coordinates: { // Latitude and longitude for each location
                lat: { type: Number },
                lng: { type: Number }
              },
    },
  ], // List of locations with detailed itinerary
  minParticipants: { type: Number, required: true },
  maxParticipants: { type: Number, required: true },
  price: { type: Number, required: true }, // price per person
  tags: { type: [String], default: [] }, // Optional tags for categorization
  participants: { 
    type: [mongoose.Schema.Types.ObjectId], 
    default: []
  },
}, { timestamps: true });

module.exports = mongoose.model('Trip', tripSchema);
