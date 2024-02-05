const passport = require('passport')
const bcrypt = require('bcryptjs')
const LocalStrategy = require('passport-local').Strategy

const authenticationMiddleware = require('./middleware')

// Create a user model
const User = require('../user/user');

//  Function to hash the password before saving it
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  };
  

// Configure Passport
function initPassport () {
    passport.use(new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password'
    },
        (username, password, done) => {
        User.findOne({ email: username })
        .then((user) => {
        if (!user) { return done(null, false, { message: 'Incorrect username.' }); }
        if (!bcrypt.compareSync(password, user.password)) { return done(null, false, { message: 'Incorrect password.' }); }
        return done(null, user); 
    })
    .catch((err) => {
        console.log(err);
        return done(err);
    });
    })
    );

    passport.authenticationMiddleware = authenticationMiddleware 

    passport.serializeUser((user, done) => {
      done(null, user.id);
    });
    
    passport.deserializeUser((id, done) => {
      console.log("here")
        User.findById(id).then((err,user) => {
            done(err,user);
        })})

}


module.exports = initPassport
