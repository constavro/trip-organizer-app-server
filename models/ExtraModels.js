const chatSchema = new mongoose.Schema({
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    ], // List of users in the chat
    messages: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      }
    ]
  }, { timestamps: true });

  const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['booking', 'review', 'chat', 'tripUpdate'], required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  });

  const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: ['credit_card', 'paypal', 'bank_transfer'], required: true },
    transactionId: { type: String, unique: true }, // Reference ID for the payment
  });

  const wishlistSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trips: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Trip' }],
  }, { timestamps: true });

  const faqSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, enum: ['booking', 'trips', 'payments', 'general'], required: true },
  });

  const activityLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g., 'created_trip', 'updated_profile', 'made_booking'
    details: { type: String }, // Additional details about the action
    timestamp: { type: Date, default: Date.now },
  });

  const supportTicketSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  });

  const couponSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true },
    discountPercentage: { type: Number, min: 0, max: 100, required: true },
    expirationDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usageLimit: { type: Number, default: null }, // Optional limit for the number of uses
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Track users who used the coupon
  });