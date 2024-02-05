const userModel = require('./user');
const bcrypt = require('bcryptjs')

//  Function to hash the password before saving it
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  };

const createUser = async (req, res, next) => {
    try {
      // Create a user model
      const User = userModel;
      const { email, password } = req.body;
  
      // Check if the email is already registered
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email is already registered' });
      }
  
      const hashedPassword = await hashPassword(password);
  
      // Create a new user
      const newUser = new User({
        email,
        password: hashedPassword,
      });
  
      // Save the user to the database
      await newUser.save();
  
      // Pass the created user to the next middleware
      req.createdUser = newUser;
      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  };

module.exports = createUser