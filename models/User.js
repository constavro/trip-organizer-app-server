// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isConfirmed: { type: Boolean, default: true }, //CHANGE TO FALSE WHEN DEVELOPMENT IS OVER
    createdAt: { type: Date, default: Date.now },
    resetPasswordToken: { type: String }, // Token for password reset
    resetPasswordExpires: { type: Date }, // Expiry time for the token
    profilePhoto: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },
    spokenLanguages: { type: [String], default: [] },
    photos: { type: [String], default: [] },
    about: { type: String, default: '', maxlength: 1000 },
    countriesVisited: { type: [String], default: [] },
    socialLinks: {
      facebook: { type: String, default: ''},
      instagram: { type: String, default: ''},
    }
});
  
module.exports = mongoose.model('User', userSchema);
