const User = require('../models/User');

const fetchUserProfile = async (userId) => {
    const user = await User.findById(userId);
  
    if (!user) throw new Error('User not found');
  
    return { user };
  };

module.exports = {fetchUserProfile}