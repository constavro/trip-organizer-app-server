function authenticationMiddleware () {
  console.log("maybe here")
    return function (req, res, next) {
      if (req.isAuthenticated()) {
        return next()
      }
      res.redirect('/')
    }
  }
  
module.exports = authenticationMiddleware