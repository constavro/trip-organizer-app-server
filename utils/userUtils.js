const User = require('../models/User');
const Profile = require('../models/Profile');

const fetchUserProfile = async (userId) => {
    const userPromise = User.findById(userId);
    const profilePromise = Profile.findOne({ userId });
    const [user, profile] = await Promise.all([userPromise, profilePromise]);
  
    if (!user) throw new Error('User not found');
    if (!profile) throw new Error('Profile not found');
  
    return { user, profile };
  };

module.exports = {fetchUserProfile}