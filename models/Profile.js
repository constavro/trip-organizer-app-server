// models/Profile.js
const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  profilePhoto: { type: String, default: '' },
  bio: { type: String, default: '' },
  spokenLanguages: { type: [String], default: [] },
  photos: { type: [String], default: [] },
  about: { type: String, default: '' },
  countriesVisited: { type: [String], default: [] },
});

module.exports = mongoose.model('Profile', profileSchema);
