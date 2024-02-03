const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const userModule = require('./user');
const authenticationModule = require('./authentication'); 

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/thesisappdb', { useNewUrlParser: true, useUnifiedTopology: true }); 

// Set up middleware 
app.use(cors());
app.use(express.json());
app.use(session({ secret: 'my-secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

authenticationModule.init(app)

userModule.init(app)

module.exports = app