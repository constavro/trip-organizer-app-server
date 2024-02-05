const passport = require('passport');
const createUser = require('./signup');
const jwt = require('jsonwebtoken')


function initUser (app) {

  app.get("/checkAuthentication", (req, res) => {

    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    jwt.verify(token, 'your-secret-key', (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
      }
      req.user = decoded; // Attach the decoded user information to the request object
      const authenticated = typeof req.user !== 'undefined';
      res.status(200).json({
        authenticated
      });
    });


  });

  app.post('/signin', passport.authenticate('local', {
    failureRedirect: "/signin/failed"
  }), function(req,res){

    const email = req.body.email
    const token = jwt.sign({ email }, 'your-secret-key', {expiresIn: '1h'});

    req.session.token = token;
    res.json({success:true, token});
  })
  
  app.post('/signup', createUser,(req,res)=>{
    res.json({success: true, user: req.body.email})
  }) 
  app.get('/logout', function(req, res, next){
    req.logOut(function(err) {
      if (err) { return next(err); }
      res.json({ message: 'Logout successful' });
    });
  });
}

module.exports = initUser