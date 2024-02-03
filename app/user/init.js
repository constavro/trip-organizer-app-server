const passport = require('passport');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs')


function initUser (app) {
  app.get('/welcome', renderWelcome)
  app.get('/profile', passport.authenticationMiddleware(), renderProfile)
  app.post('/signin', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        console.error('Error during authentication:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
  
      if (!user) {
        console.log('Authentication failed:', info.message);
        return res.status(401).json({ error: 'Authentication failed', message: info.message });
      }
  
      // Authentication successful
      req.logIn(user, (err) => {
        if (err) {
          console.error('Error during login:', err);
          return res.status(500).json({ error: 'Internal Server Error' });
        }
  
        console.log('Authentication successful');
        // You can include any user-related data in the response
        const responseData = {
          message: 'Authentication successful',
          user: {
            id: user.id,
            username: user.username,
            // Add other user properties as needed 
          },
        };
  
        return res.status(200).json(responseData);
      });
    })(req, res, next);
  });
  
  app.post('/signup', createUser, renderProfile) 
  app.post('/logout', function(req, res, next){
    console.log("HERE")
    req.logOut(function(err) {
      if (err) { return next(err); }
      res.json({ message: 'Logout successful' });
      res.redirect('/welcome');
    });
  });
}



//  Function to hash the password before saving it
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

const createUser = async (req, res, next) => {
  try {
    // Create a user model
  const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    email: String,
    password: String,
  }));
    const { username, email, password } = req.body;

    // Check if the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    const hashedPassword = await hashPassword(password);

    // Create a new user
    const newUser = new User({
      username,
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


function renderWelcome (req, res) {
  console.log("Welcome")
  // res.render('user/welcome')
}

function renderProfile (req, res) {
  console.log("profile")
  res.send(200)
  // res.render('user/profile', {
    // username: req.user.username
  // })
}

module.exports = initUser