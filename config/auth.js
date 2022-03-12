module.exports = {
    ensureAuthenticated: function(req, res, next) {
        // console.log("Value during user login: " + req.user)
        if(req.isAuthenticated()) {
            return next();
        }
        req.flash('error_msg', 'Please Login first');
        res.redirect('/users/login');
    }
}