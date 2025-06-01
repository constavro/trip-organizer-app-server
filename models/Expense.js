// models/Expense.js
const mongoose = require("mongoose");

const splitParticipantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amountOwed: { type: Number }, // Used if split is 'unequally' or 'itemized'
  // percentage: { type: Number, min: 0, max: 100 } // Used if split 'by_percentage'
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
  payer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, required: true, default: 'EUR', trim: true, uppercase: true },
  description: { type: String, required: true, trim: true, maxlength: 200 },
  category: {
    type: String,
    // Consider making this an array if an expense can belong to multiple categories, or keep as single
    enum: [
        "Food & Drinks", "Groceries", "Restaurants & Cafes",
        "Transportation", "Flights", "Trains", "Buses & Taxis", "Fuel", "Rental Car",
        "Accommodation", "Hotel", "Hostel", "Vacation Rental",
        "Activities & Entertainment", "Tours", "Tickets & Events", "Souvenirs", "Shopping",
        "Health & Wellness", "Fees & Charges", "Utilities", "Gifts", "Miscellaneous"
    ],
    required: true
  },
  expenseDate: { type: Date, default: Date.now, required: true },
  splitDetails: {
      type: {
          type: String,
          enum: ['equally', 'unequally_by_amount', /* 'by_percentage', 'itemized' */], // Added more specific types
          required: true,
          default: 'equally'
      },
      participants: [splitParticipantSchema] // Array of users involved in the split and their share
  },
  receiptImage: { type: String, default: '' }, // URL to an image of the receipt
  notes: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true }); // Adds createdAt, updatedAt

// Validation: Ensure sum of amountOwed equals total amount for 'unequally_by_amount' (backend)
// Validation: Ensure all participants in splitDetails.participants are part of the trip (backend)
// Validation: Ensure splitDetails.participants is not empty (backend)

module.exports = mongoose.model("Expense", expenseSchema);