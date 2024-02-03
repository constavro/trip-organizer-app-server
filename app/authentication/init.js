const passport = require('passport')
const bcrypt = require('bcryptjs')
const LocalStrategy = require('passport-local').Strategy
const mongoose = require('mongoose');

const authenticationMiddleware = require('./middleware')

// Create a user model
const UserAuth = mongoose.model('user', new mongoose.Schema({
    username: String,
    email: String,
    password: String,
  }));

//  Function to hash the password before saving it
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  };
  

// Configure Passport
function initPassport () {
    passport.use(new LocalStrategy(
        (username, password, done) => {
        UserAuth.findOne({ username: username })
        .then((user) => {
        if (!user) { return done(null, false, { message: 'Incorrect username.' }); }
        if (!bcrypt.compareSync(password, user.password)) { return done(null, false, { message: 'Incorrect password.' }); }
        console.log("DEFINETELY HERE")
        return done(null, user);
    })
    .catch((err) => {
        console.log(err);
        return done(err);
    });
    }));

    console.log("HERE")
    passport.authenticationMiddleware = authenticationMiddleware 
    console.log("NOT HERE")
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
    UserAuth.findById(id).then((err,user) => {
        done(err,user);
    })})

module.exports = initPassport
