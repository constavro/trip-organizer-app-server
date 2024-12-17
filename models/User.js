// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isConfirmed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['admin', 'user'], default: 'user' }, // Roles
    resetPasswordToken: { type: String }, // Token for password reset
    resetPasswordExpires: { type: Date }, // Expiry time for the token
});
  
module.exports = mongoose.model('User', userSchema);
