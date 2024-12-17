// models/Profile.js
const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  profilePhoto: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 500 },
  spokenLanguages: { type: [String], default: [] },
  photos: { type: [String], default: [], validate: [arr => arr.length <= 10, 'Maximum 10 photos allowed'] },
  about: { type: String, default: '', maxlength: 1000 },
  countriesVisited: { type: [String], default: [] },
  socialLinks: {
    facebook: { type: String },
    instagram: { type: String },
  }
});

module.exports = mongoose.model('Profile', profileSchema);
