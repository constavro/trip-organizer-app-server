const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Trip = require('../models/Trip');
const authMiddleware = require('../middleware/authMiddleware');

// Get expenses for a trip
router.get('/trip/:tripId', authMiddleware, async (req, res) => {
  try {
    const expenses = await Expense.find({ trip: req.params.tripId })
      .populate('payer', 'firstName')
      .populate('splitBetween', 'firstName');

    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get balance per trip for current user
router.get('/mybalances', authMiddleware, async (req, res) => {
  try {
    const trips = await Trip.find({ participants: req.user.id }).select('title');
    const balances = [];

    for (const trip of trips) {
      const expenses = await Expense.find({ trip: trip._id });

      let paid = 0;
      let owed = 0;

      expenses.forEach(exp => {
        if (exp.payer.toString() === req.user.id) {
          paid += exp.amount;
        }
        if (exp.splitBetween.map(id => id.toString()).includes(req.user.id)) {
          owed += exp.amount / exp.splitBetween.length;
        }
      });

      balances.push({
        tripId: trip._id,
        tripTitle: trip.title,
        balance: (paid - owed).toFixed(2),
      });
    }

    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add an expense
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { trip, amount, description, category, splitBetween } = req.body;

    console.log(req.body)

    const expense = new Expense({
      trip,
      amount,
      payer: req.user.id,
      description,
      category,
      splitBetween,
    });

    await expense.save();
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
