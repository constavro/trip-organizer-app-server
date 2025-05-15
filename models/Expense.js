const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true }, // The trip this expense belongs to
  payer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Who paid?
  amount: { type: Number, required: true }, // Amount spent
  description: { type: String, required: true }, // What was it for? (e.g., "Dinner at Italian restaurant")
  category: { 
    type: String, 
    enum: ["Food", "Transport", "Accommodation", "Activities", "Miscellaneous"], 
    required: true 
  }, // Type of expense
  splitBetween: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Who shares the expense?
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Expense", expenseSchema);