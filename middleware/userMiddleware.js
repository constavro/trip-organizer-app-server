const authorizeUser = (req, res, next) => {
    const { userId } = req.params;
    if (req.user.id.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You can only edit your own profile' });
    }
    next();
  };

  module.exports = authorizeUser;