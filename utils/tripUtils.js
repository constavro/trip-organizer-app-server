const tripSchema = {
  title: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  description: {
    overview: { type: String, required: true }, // Overview of the trip
    inclusions: { type: [String], required: true }, // List of items/services included
    exclusions: { type: [String], required: true }, // List of items/services not included
  }, // Structured description with detailed fields
  itinerary: [
    {
      order: { type: Number, required: true }, // Order of the stop in the itinerary
      location: { type: String, required: true }, // Location name
      startDate: { type: Date, required: true }, // Date of the visit
      endDate: { type: Date, required: true }, // Date of the visit
      notes: { type: String }, // Additional details or notes for the stop
      transportation: [{ type: String }], // Multiple transport modes (e.g., bus, train, flight)
      accommodation: { type: String, required: true }, // Details about accommodation
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
  price: { type: Number, required: true }, // price per person
  tags: { type: [String], default: [] }, // Optional tags for categorization
}

// Utility: Send Error Response
const sendError = (res, status, message, error = '') =>
    res.status(status).json({ message, ...(error && { error }) });
  
// Utility: Validate Pagination
const getPagination = (req) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    return { page, limit, skip: (page - 1) * limit };
  };

// services/aiTripService.js
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateAITrip({ startDate, endDate, area, participants, userId }) {

const response = await openai.chat.completions.create({
  model: "gpt-4.1-nano",
  messages: [
    {
      "role": "system",
      "content": [
        {
          "text": "I want to create a tool that generates a trip with the following schema:\n\nconst tripSchema = {\n  title: { type: String, required: true },\n  startDate: { type: Date, required: true },\n  endDate: { type: Date, required: true },\n  description: {\n    overview: { type: String, required: true }, // Overview of the trip\n    inclusions: { type: [String], required: true }, // List of items/services included\n    exclusions: { type: [String], required: true }, // List of items/services not included\n  }, // Structured description with detailed fields\n  itinerary: [\n    {\n      order: { type: Number, required: true }, // Order of the stop in the itinerary\n      location: { type: String, required: true }, // Location name\n      startDate: { type: Date, required: true }, // Date of the visit\n      endDate: { type: Date, required: true }, // Date of the visit\n      notes: { type: String }, // Additional details or notes for the stop\n      transportation: [{ type: String }], // Multiple transport modes (e.g., bus, train, flight)\n      accommodation: { type: String, required: true }, // Details about accommodation\n      geoLocation: { // Latitude & longitude\n        lat: { type: Number },\n        lng: { type: Number }\n      },\n      activities: [{ type: String }], // List of planned activities at the location\n      costEstimate: { type: Number, default: 0 } // Estimated cost for this part of the trip\n    }\n  ],\n  minParticipants: { type: Number, required: true },\n  maxParticipants: { type: Number, required: true },\n  price: { type: Number, required: true }, // price per person\n  tags: { type: [String], default: [] }, // Optional tags for categorization\n}",
          "type": "text"
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "text": `\nCreate a detailed travel itinerary for a trip to ${area} from ${startDate} to ${endDate} for ${participants} participants.\nThe response should be a plain json withoun quotes or the word json in front and the columns should be quoted;`,
          "type": "text"
        }
      ]
    }
  ],
  response_format: {
    "type": "text"
  },
  temperature: 1,
  max_completion_tokens: 2048,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0
});

const responseText = response.choices[0].message.content;

const parsedTrip = JSON.parse(responseText);

  return {
    ...parsedTrip,
    organizer: userId,
  };
}


module.exports = { sendError, getPagination, generateAITrip };