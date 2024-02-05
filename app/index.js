const express = require('express');
const passport = require('passport');
const session = require('express-session');
const mongoose = require('mongoose');
const cors = require('cors');
const userModule = require('./user');
const authenticationModule = require('./authentication'); 

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/thesisappdb', { useNewUrlParser: true, useUnifiedTopology: true }); 

// Set up middleware 
app.use(cors({
    origin: "http://localhost:3000",
    method: "GET,POST,PUT,DELETE",
    credentials: true
}));
app.use(express.json());
app.use(session({ secret: 'my-secret', resave: false, saveUninitialized: true, cookie: {maxAge: 1000*60*60} }));
app.use(passport.initialize());
app.use(passport.session());

authenticationModule.init(app)

userModule.init(app)

module.exports = app