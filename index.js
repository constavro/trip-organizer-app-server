// const app = require('./app')
// const port = process.env.PORT || 5000

// app.listen(port, function (err) {
//   if (err) {
//     throw err
//   }

//   console.log(`server is listening on ${port}...`)
// })

const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();

// Connect to MongoDB
// mongoose.connect('mongodb://localhost/authdemo', { useNewUrlParser: true, useUnifiedTopology: true });

// Create a user model
// const User = mongoose.model('User', new mongoose.Schema({
//   username: String,
//   password: String,
// }));

// Configure Passport
passport.use(new LocalStrategy((username, password, done) => {
  User.findOne({ username: username }, (err, user) => {
    if (err) { return done(err); }
    if (!user) { return done(null, false, { message: 'Incorrect username.' }); }
    if (!bcrypt.compareSync(password, user.password)) { return done(null, false, { message: 'Incorrect password.' }); }
    return done(null, user);
  });
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

// Set up middleware
app.use(express.json());
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.post('/api/login', passport.authenticate('local'), (req, res) => {
  res.json(req.user);
});

app.get('/api/logout', (req, res) => {
  req.logout();
  res.json({ message: 'Logged out successfully.' });
});

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

app.post('/signup', (req, res) => {
  console.log(req.body)
});

app.post('/signin', (req, res) => {
  console.log(req.body)
});

app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
