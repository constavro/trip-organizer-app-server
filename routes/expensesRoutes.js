// routes/expensesRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Trip = require('../models/Trip');
// User model might not be needed directly in all routes if only IDs are handled
// const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// This is a simplified version focused on a single trip for settlement
async function calculateTripBalancesForSettlement(tripId, allTripParticipants) {
  const expenses = await Expense.find({ trip: tripId })
      .populate('payer', '_id')
      .populate('splitDetails.participants.user', '_id')
      .lean();

  const userBalances = {}; // { userId: balance }
  allTripParticipants.forEach(p => userBalances[p._id.toString()] = 0);

  expenses.forEach(exp => {
      const payerId = exp.payer._id.toString();
      const amount = exp.amount;

      // Payer gets credited
      if (userBalances[payerId] !== undefined) {
          userBalances[payerId] += amount;
      }

      // Participants get debited their share
      if (exp.splitDetails && exp.splitDetails.participants) {
          const { type, participants: splitParticipants } = exp.splitDetails;
          const numSplitParticipants = splitParticipants.length;

          if (numSplitParticipants === 0) return;

          splitParticipants.forEach(sp => {
              const participantUserId = sp.user._id.toString();
              if (userBalances[participantUserId] === undefined) return;

              let share = 0;
              if (type === 'equally') {
                  share = amount / numSplitParticipants;
              } else if (type === 'unequally_by_amount') {
                  share = sp.amountOwed || 0;
              } else if (type === 'SETTLEMENT_PAYOUT') {
                  // This is money received by participant, so it reduces their share of costs/increases their credit
                  share = sp.amountOwed || 0; // For settlement, amountOwed is amount received
              }
              // For regular expenses, share is a cost. For SETTLEMENT_PAYOUT, it's a credit received.
              // The balance calculation logic needs to correctly interpret this.
              // Original balance logic: totalPaidByMe - totalMyShare
              // If this is a settlement I receive: my share of costs effectively decreases.
              // If it's a settlement I pay: I paid it, it adds to totalPaidByMe.
              
              // Let's adjust how SETTLEMENT_PAYOUT affects balances here:
              // If an expense is a SETTLEMENT_PAYOUT, the 'payer' is the one settling.
              // The 'splitDetails.participants' are the recipients.
              // So, for recipients, their balance should go UP (they are owed less, or get cash).
              // And for the payer, their balance should go DOWN (they paid out).
              // The generic expense calculation already handles the payer part (totalPaidByMe += amount).
              // For the recipients of a SETTLEMENT_PAYOUT:
              if (type === 'SETTLEMENT_PAYOUT') {
                   // If user 'participantUserId' is in splitDetails, they received 'share'.
                   // This means their net balance *increases* by 'share'.
                   // So, if their balance was -50 (owe 50), and they receive 20, it becomes -30.
                   // If their balance was +50 (owed 50), and they receive 20, it becomes +70.
                   // The current debiting logic (userBalances[participantUserId] -= share) for standard expenses needs care.
                   // For SETTLEMENT_PAYOUT, for a participant, it's a credit.
                   // Let's rethink. The primary balance logic is (Total I Paid) - (My Share of Total Costs)
                   // A settlement I pay: increases "Total I Paid".
                   // A settlement I receive (I am a participant in someone else's SETTLEMENT_PAYOUT): decreases "My Share of Total Costs"
                   // So, for SETTLEMENT_PAYOUT, the 'amountOwed' for a participant IS their share of the cost for this "expense"
                   // which means it reduces their positive balance or increases their negative balance.
                   // This means the existing userBalances[participantUserId] -= share; is correct if 'share' is amount received.
                  userBalances[participantUserId] -= share; // This is correct. If I receive 50, my "share" of costs reduces by 50.

              } else { // For 'equally' and 'unequally_by_amount'
                  userBalances[participantUserId] -= share;
              }
          });
      }
  });
  return userBalances;
}

// Helper to get trip participants and validate user access
async function getTripAndValidateAccess(tripId, userId) {
  if (!mongoose.Types.ObjectId.isValid(tripId)) {
      const err = new Error('Invalid Trip ID');
      err.status = 400;
      throw err;
  }
  const trip = await Trip.findById(tripId)
      .populate('participants', 'firstName lastName email profilePhoto _id')
      .populate('organizer', 'firstName lastName email profilePhoto _id')
      .lean();

  if (!trip) {
      const err = new Error('Trip not found');
      err.status = 404;
      throw err;
  }

  const isOrganizer = trip.organizer._id.equals(userId);
  const isParticipant = trip.participants.some(p => p._id.equals(userId));

  if (!isOrganizer && !isParticipant) {
      const err = new Error('User not authorized for this trip');
      err.status = 403;
      throw err;
  }
  
  let allInvolvedUsers = [...trip.participants];
   allInvolvedUsers = allInvolvedUsers.filter((user, index, self) =>
      index === self.findIndex((u) => u._id.equals(user._id))
  );

  return { tripTitle: trip.title, participants: allInvolvedUsers, tripOrganizerId: trip.organizer._id };
}



// GET expenses and participant info for a specific trip
router.get('/trip/:tripId', authMiddleware, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id; // String from token
    
    const { tripTitle, participants: tripParticipants } = await getTripAndValidateAccess(tripId, new mongoose.Types.ObjectId(userId));

    const expenses = await Expense.find({ trip: tripId })
      .populate('payer', 'firstName lastName profilePhoto _id')
      .populate('splitDetails.participants.user', 'firstName lastName profilePhoto _id')
      .sort({ createdAt: -1 })
      .lean();

    console.log(tripParticipants)

    res.json({ tripTitle, expenses, participants: tripParticipants });
  } catch (err) {
    console.error("Error fetching trip expenses:", err);
    res.status(err.status || 500).json({ message: err.message || 'Failed to fetch trip expenses' });
  }
});

// Get summary of what user owes and is owed across all their trips (balances)
router.get('/mybalances', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Find all trips where the user is either an organizer or a participant
    const userTrips = await Trip.find({
      $or: [{ organizer: userId }, { participants: userId }]
    }).select('_id title coverPhoto'); // Include coverPhoto for better UI

    if (!userTrips.length) {
      return res.json([]);
    }

    const tripIds = userTrips.map(trip => trip._id);

    // Fetch all expenses for these trips in one go
    const allExpensesForUserTrips = await Expense.find({ trip: { $in: tripIds } })
                                           .populate('payer', '_id') // Only need payer ID
                                           .populate('splitDetails.participants.user', '_id') // Only need user ID in split
                                           .lean(); // Use lean for performance

    const balances = userTrips.map(trip => {
      let totalPaidByMe = 0;
      let totalMyShare = 0;
      const tripCurrency = 'EUR'; // Default or fetch from trip model if it exists there

      allExpensesForUserTrips
        .filter(exp => exp.trip.equals(trip._id))
        .forEach(exp => {
          // I am the payer
          if (exp.payer._id.equals(userId)) {
            totalPaidByMe += exp.amount;
          }

          // Calculate my share if I'm involved in the split
          const mySplitDetail = exp.splitDetails.participants.find(p => p.user._id.equals(userId));
          if (mySplitDetail) {
            switch (exp.splitDetails.type) {
              case 'equally':
                totalMyShare += exp.amount / exp.splitDetails.participants.length;
                break;
              case 'unequally_by_amount':
                totalMyShare += mySplitDetail.amountOwed || 0;
                break;
              case 'SETTLEMENT_PAYOUT':
                  totalMyShare += mySplitDetail.amountOwed || 0;
                  break;
              default:
                // Fallback or error for unhandled split types
                break;
            }
          }
        });

      const netBalance = totalPaidByMe - totalMyShare;
      return {
        tripId: trip._id,
        tripTitle: trip.title,
        tripCoverPhoto: trip.coverPhoto,
        balance: parseFloat(netBalance.toFixed(2)), // Ensure 2 decimal places
        currency: tripCurrency, // Assuming all expenses in a trip have same currency for summary
        // You could also add totalOwedToMe and totalIOwe for more detailed summary
      };
    });
    
    // Sort balances by trip title or another metric if desired
    balances.sort((a,b) => a.tripTitle.localeCompare(b.tripTitle));

    res.json(balances);
  } catch (err) {
    console.error("Error fetching mybalances:", err);
    res.status(500).json({ message: err.message || 'Failed to fetch balances.' });
  }
});


// Add an expense
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      trip: tripId,
      amount,
      currency, // Default currency if not provided
      description,
      category,
      expenseDate,
      splitDetails, // Expecting { type: 'equally'/'unequally_by_amount'/ participants: [{ user: 'id', amountOwed?: num, shares?: num }] }
      notes,
      // receiptImage // Handle file upload separately if implementing
    } = req.body;

    const payerId = req.user.id;

    // --- Basic Validations ---
    if (!mongoose.Types.ObjectId.isValid(tripId)) return res.status(400).json({ message: 'Invalid Trip ID.' });
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ message: 'Amount must be a positive number.' });
    if (!description || description.trim() === '') return res.status(400).json({ message: 'Description is required.' });
    if (!category) return res.status(400).json({ message: 'Category is required.' });
    if (!splitDetails || !splitDetails.type || !splitDetails.participants || splitDetails.participants.length === 0) {
      return res.status(400).json({ message: 'Split details and participants are required.' });
    }

    // --- Trip and Participant Validation ---
    const trip = await Trip.findById(tripId).populate('participants', '_id').populate('organizer', '_id');
    if (!trip) return res.status(404).json({ message: 'Trip not found.' });

    const tripMemberIds = new Set([...trip.participants.map(p => p._id.toString()), trip.organizer._id.toString()]);
    if (!tripMemberIds.has(payerId)) {
        return res.status(403).json({ message: 'Payer is not part of this trip.' });
    }
    for (const p of splitDetails.participants) {
        if (!mongoose.Types.ObjectId.isValid(p.user)) return res.status(400).json({ message: `Invalid participant user ID: ${p.user}`});
        if (!tripMemberIds.has(p.user.toString())) {
            return res.status(400).json({ message: `Participant ${p.user} is not part of this trip.` });
        }
    }
    
    // --- Split Logic Validation ---
    const parsedAmount = parseFloat(amount);
    if (splitDetails.type === 'unequally_by_amount') {
      const sumOfOwedAmounts = splitDetails.participants.reduce((sum, p) => sum + (parseFloat(p.amountOwed) || 0), 0);
      if (Math.abs(sumOfOwedAmounts - parsedAmount) > 0.01) { // Allow for small floating point discrepancies
        return res.status(400).json({ message: `Sum of owed amounts (${sumOfOwedAmounts.toFixed(2)}) does not match total expense amount (${parsedAmount.toFixed(2)}).` });
      }
    }
    // For 'equally', no specific amount validation needed per participant beyond them being listed.

    const expense = new Expense({
      trip: tripId,
      payer: payerId,
      amount: parsedAmount,
      currency: currency.toUpperCase(),
      description,
      category,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      splitDetails: {
          type: splitDetails.type,
          // Ensure participant objects match the sub-schema (user, amountOwed, shares)
          participants: splitDetails.participants.map(p => ({
              user: p.user,
              amountOwed: splitDetails.type === 'unequally_by_amount' ? parseFloat(p.amountOwed) || 0 : undefined,
          }))
      },
      notes,
      // receiptImage // Store URL if uploaded
    });

    await expense.save();

    // Populate for response
    const populatedExpense = await Expense.findById(expense._id)
        .populate('payer', 'firstName lastName profilePhoto')
        .populate('splitDetails.participants.user', 'firstName lastName profilePhoto')
        .lean();

    res.status(201).json(populatedExpense);
  } catch (err) {
    console.error("Error adding expense:", err);
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: "Validation Error", errors: err.errors });
    }
    res.status(500).json({ message: err.message || 'Failed to add expense.' });
  }
});


// TODO: Add routes for updating and deleting expenses (with permission checks)
// PUT /:expenseId - Update an expense
router.put('/:expenseId', authMiddleware, async (req, res) => {
  try {
      const { expenseId } = req.params;
      const userId = new mongoose.Types.ObjectId(req.user.id);

      if (!mongoose.Types.ObjectId.isValid(expenseId)) {
          return res.status(400).json({ message: 'Invalid Expense ID.' });
      }

      const expense = await Expense.findById(expenseId);
      if (!expense) {
          return res.status(404).json({ message: 'Expense not found.' });
      }

      // Authorization: Only payer or trip organizer can edit
      const trip = await Trip.findById(expense.trip).select('organizer').lean();
      if (!trip) {
          return res.status(404).json({ message: 'Associated trip not found.' });
      }

      const canEdit = expense.payer.equals(userId) || (trip.organizer && trip.organizer.equals(userId));
      if (!canEdit) {
          return res.status(403).json({ message: 'You are not authorized to edit this expense.' });
      }

      const {
          amount, currency, description, category, expenseDate,
          splitDetails, notes // receiptImage might need separate handling
      } = req.body;

      // --- Validations (similar to POST route) ---
      if (amount !== undefined && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
          return res.status(400).json({ message: 'Amount must be a positive number.' });
      }
      // Add more specific validations for other fields if they are being updated
      if (splitDetails) {
          if (!splitDetails.type || !splitDetails.participants || splitDetails.participants.length === 0) {
              return res.status(400).json({ message: 'Split details and participants are required if provided.' });
          }
          const parsedAmount = parseFloat(amount || expense.amount); // Use new amount if provided, else existing
          if (splitDetails.type === 'unequally_by_amount') {
              const sumOfOwedAmounts = splitDetails.participants.reduce((sum, p) => sum + (parseFloat(p.amountOwed) || 0), 0);
              if (Math.abs(sumOfOwedAmounts - parsedAmount) > 0.01) {
                  return res.status(400).json({ message: `Sum of owed amounts (${sumOfOwedAmounts.toFixed(2)}) does not match total expense amount (${parsedAmount.toFixed(2)}).` });
              }
          } // Add validation for other split types if necessary
      }
      // --- End Validations ---

      // Update fields if they are provided in the request body
      if (amount !== undefined) expense.amount = parseFloat(amount);
      if (currency !== undefined) expense.currency = currency.toUpperCase();
      if (description !== undefined) expense.description = description;
      if (category !== undefined) expense.category = category;
      if (expenseDate !== undefined) expense.expenseDate = new Date(expenseDate);
      if (notes !== undefined) expense.notes = notes;
      
      if (splitDetails) {
          expense.splitDetails = {
              type: splitDetails.type,
              participants: splitDetails.participants.map(p => ({
                  user: p.user, // Assuming frontend sends valid user ObjectId string
                  amountOwed: splitDetails.type === 'unequally_by_amount' ? parseFloat(p.amountOwed) || 0 : undefined,
                  shares: splitDetails.type === 'by_shares' ? parseInt(p.shares) || 1 : undefined,
              }))
          };
      }

      const updatedExpense = await expense.save();
      const populatedExpense = await Expense.findById(updatedExpense._id)
          .populate('payer', 'firstName lastName profilePhoto _id')
          .populate('splitDetails.participants.user', 'firstName lastName profilePhoto _id')
          .lean();

      res.json(populatedExpense);
  } catch (err) {
      console.error("Error updating expense:", err);
      if (err.name === 'ValidationError') {
          return res.status(400).json({ message: "Validation Error", errors: err.errors });
      }
      res.status(500).json({ message: err.message || 'Failed to update expense.' });
  }
});


// DELETE /:expenseId - Delete an expense
router.delete('/:expenseId', authMiddleware, async (req, res) => {
  try {
      const { expenseId } = req.params;
      const userId = new mongoose.Types.ObjectId(req.user.id);

      if (!mongoose.Types.ObjectId.isValid(expenseId)) {
          return res.status(400).json({ message: 'Invalid Expense ID.' });
      }

      const expense = await Expense.findById(expenseId);
      if (!expense) {
          return res.status(404).json({ message: 'Expense not found.' });
      }

      // Authorization: Only payer or trip organizer can delete
      const trip = await Trip.findById(expense.trip).select('organizer').lean();
      if (!trip) {
          // This case should ideally not happen if expense exists, but good for robustness
          return res.status(404).json({ message: 'Associated trip not found.' });
      }
      
      const canDelete = expense.payer.equals(userId) || (trip.organizer && trip.organizer.equals(userId));
      if (!canDelete) {
          return res.status(403).json({ message: 'You are not authorized to delete this expense.' });
      }

      await Expense.findByIdAndDelete(expenseId); // Use findByIdAndDelete

      res.json({ message: 'Expense deleted successfully.' });
  } catch (err) {
      console.error("Error deleting expense:", err);
      res.status(500).json({ message: err.message || 'Failed to delete expense.' });
  }
});

// POST /api/expenses/trip/:tripId/settle - Current user settles their debts for this trip
router.post('/trip/:tripId/settle', authMiddleware, async (req, res) => {
  try {
      const { tripId } = req.params;
      const currentUserId = new mongoose.Types.ObjectId(req.user.id);
      const currentUserObjectIdString = req.user.id;


      if (!mongoose.Types.ObjectId.isValid(tripId)) {
          return res.status(400).json({ message: 'Invalid Trip ID.' });
      }

      const trip = await Trip.findById(tripId)
          .populate('participants', '_id firstName lastName email profilePhoto') // Ensure full participant details
          .populate('organizer', '_id firstName lastName email profilePhoto')
          .lean();

      if (!trip) {
          return res.status(404).json({ message: 'Trip not found.' });
      }

      const isOrganizer = trip.organizer._id.equals(currentUserId);
      const isParticipant = trip.participants.some(p => p._id.equals(currentUserId));

      if (!isOrganizer && !isParticipant) {
          return res.status(403).json({ message: 'User not authorized for this trip.' });
      }
      
      let allTripUsers = [...trip.participants];
      if (!trip.participants.find(p => p._id.equals(trip.organizer._id))) {
          allTripUsers.push(trip.organizer); // Add organizer if not already in participants
      }
      // Deduplicate allTripUsers
      allTripUsers = allTripUsers.filter((user, index, self) =>
          index === self.findIndex((u) => u._id.equals(user._id))
      );


      const balances = await calculateTripBalancesForSettlement(tripId, allTripUsers);

      const currentUserBalance = balances[currentUserObjectIdString] || 0;

      if (currentUserBalance >= -0.001) { // Using a small epsilon for floating point
          return res.status(400).json({ message: 'You have no outstanding debts to settle for this trip.' });
      }

      const amountToSettle = Math.abs(currentUserBalance);
      let remainingAmountToDistribute = amountToSettle;
      const settlementPayouts = [];

      // Identify creditors (those owed money by the group)
      const creditors = [];
      for (const userId in balances) {
          if (userId !== currentUserObjectIdString && balances[userId] > 0.001) { // User is owed money
              creditors.push({ userId: new mongoose.Types.ObjectId(userId), amountOwedByGroup: balances[userId] });
          }
      }

      if (creditors.length === 0 && amountToSettle > 0) {
           console.warn(`User ${currentUserObjectIdString} owes ${amountToSettle} but no clear creditors found in trip ${tripId}. This might indicate a complex balance state.`);
      }


      const totalCreditOwedByGroup = creditors.reduce((sum, c) => sum + c.amountOwedByGroup, 0);

      if (totalCreditOwedByGroup > 0.001) { // Only distribute if there's actual credit to pay into
          for (const creditor of creditors) {
              if (remainingAmountToDistribute <= 0.001) break;

              // Proportional distribution
              let amountPaidToCreditor = (creditor.amountOwedByGroup / totalCreditOwedByGroup) * amountToSettle;
              amountPaidToCreditor = Math.min(amountPaidToCreditor, creditor.amountOwedByGroup, remainingAmountToDistribute);
              amountPaidToCreditor = parseFloat(amountPaidToCreditor.toFixed(2));


              if (amountPaidToCreditor > 0.001) {
                  settlementPayouts.push({
                      user: creditor.userId,
                      amountOwed: amountPaidToCreditor // 'amountOwed' here means 'amount received by this creditor'
                  });
                  remainingAmountToDistribute -= amountPaidToCreditor;
              }
          }
      }
      
      // If after distribution there's still a tiny remaining amount due to rounding,
      // and there are payouts, add it to the first person who received something.
       if (remainingAmountToDistribute > 0.001 && remainingAmountToDistribute < 0.05 && settlementPayouts.length > 0) { // Small rounding residual
          settlementPayouts[0].amountOwed = parseFloat((settlementPayouts[0].amountOwed + remainingAmountToDistribute).toFixed(2));
          remainingAmountToDistribute = 0;
      }


      if (remainingAmountToDistribute > 0.01 && settlementPayouts.length === 0 && amountToSettle > 0) {
          console.warn(`Settlement by ${currentUserObjectIdString} for ${amountToSettle} in trip ${tripId}, but no recipients in splitDetails. Check balances.`);
      }


      const settlementExpense = new Expense({
          trip: tripId,
          payer: currentUserId,
          amount: parseFloat(amountToSettle.toFixed(2)),
          currency: trip.currency || 'EUR', // Assuming trip has a currency, or use a default
          description: `Settlement by ${trip.organizer._id.equals(currentUserId) ? trip.organizer.firstName : allTripUsers.find(u=>u._id.equals(currentUserId))?.firstName || 'User'}`,
          category: 'SETTLEMENT',
          expenseDate: new Date(),
          splitDetails: {
              type: 'SETTLEMENT_PAYOUT',
              participants: settlementPayouts
          },
          notes: 'User initiated settlement of their debts for this trip.'
      });

      await settlementExpense.save();

      // Populate for response (optional, frontend usually refetches)
      const populatedSettlement = await Expense.findById(settlementExpense._id)
          .populate('payer', 'firstName lastName profilePhoto')
          .populate('splitDetails.participants.user', 'firstName lastName profilePhoto')
          .lean();

      res.status(201).json({ message: 'Debts settled successfully.', settlement: populatedSettlement });

  } catch (err) {
      console.error("Error settling debts:", err);
      res.status(500).json({ message: err.message || 'Failed to settle debts.' });
  }
});


module.exports = router;