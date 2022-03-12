const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const async = require('async');
const crypto = require('crypto');
var fs = require('fs');
const xlsx = require('xlsx');
var emailer = require('../app')
//aws mailing packaging
const AWS = require('aws-sdk');
const nodemailer = require('nodemailer');
const sesTransport = require('nodemailer-ses-transport');
//User model
const User = require('../models/User');
const Logs = require('../models/Logs');
const Mails = require('../models/Mails');
// const Admin = require('../models/Admin');

//aws mail config
let transporter;
AWS.config.update({
    accessKeyId: '<read-from-env>',
    secretAccessKey: '<read-from-env>',
    region: '<read-from-env>',
    maxRetries: 1
});
const SES = new AWS.SES();
transporter = nodemailer.createTransport(sesTransport({
    ses: SES
}));

//To redirect if user already logged in
function ensureNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user.admin) {
            return res.redirect('/users/adminpage');
        }
        return res.redirect('/dashboard');
    }
    next();
}

//To guard adminpage route
function adminAuthenticated(req, res, next) {
    // console.log("Value of req during adminlogin " + req.user);
    if (req.isAuthenticated() && req.user.admin == true) {
        return next();
    }
    req.flash('error_msg', 'Please Login as Admin first');
    res.redirect('/users/adminlogin');
}

//LOGIN page
router.get('/login', ensureNotAuthenticated, (req, res) => res.render('login'));

//Register Page
router.get('/register', ensureNotAuthenticated, (req, res) => res.render('register'));

//Admin Login Page
router.get('/adminlogin', ensureNotAuthenticated, (reqq, res) => res.render('adminlogin'));


//Register Handle
let requests = [];    //to store latest user requests to be displayed on adminpage
let vers = [];        //to store verified users for displaying them on adminpage
let backlogs = [];
emailer.loggs;
router.post('/register', (req, res) => {
    const { name, email, password, password2 } = req.body;
    let errors = [];
    //Form Validation
    if (!name || !email || !password || !password2) {
        errors.push({ msg: 'Please fill in all the details.' });
    }
    if (password != password2) {
        errors.push({ msg: 'Passwords do not match.' });
    }
    if (password.length < 6) {
        errors.push({ msg: 'Password should be 6 characters long!!' });
    }
    if (errors.length > 0) {
        res.render('register', {
            errors,
            name,
            email,
            password,
            password2
        });
    } else {
        //After successful validation
        User.findOne({ email: email })
            .then(user => {
                if (user) {
                    //User already exists
                    errors.push({ msg: 'Email is already registered' });
                    res.render('register', {
                        errors,
                        name,
                        email,
                        password,
                        password2
                    });
                } else {
                    const newUser = new User({
                        name,
                        email,
                        password
                    });

                    //Hash Password using bcrypt
                    bcrypt.genSalt(10, (err, salt) =>
                        bcrypt.hash(newUser.password, salt, (err, hash) => {
                            if (err) throw err;

                            newUser.password = hash;

                            //Save User
                            newUser.save()
                                .then(user => {
                                    requests.push(user);
                                    // res.render('adminreg', {requests: requests});
                                    req.flash('success_msg', 'Thank you for registering. Kindly wiat till an admin validates your account.');
                                    res.redirect('/users/login');
                                    // console.log(requests);
                                })
                                .catch(err => console.log(err));
                        }));
                }
            });
    }
});

//Admin Page functions
User.find({ valid: false, admin: false }).then(users => {
    users.forEach(function (user) {
        if (!user.admin) {
            if (!requests.includes(user)) {
                requests.push(user);
            }
        }
    })
    console.log(requests)
})
User.find({ valid: true }).then(users => {
    users.forEach(function (user) {
        if (!vers.includes(user)) {
            vers.push(user);
        }
    })
    console.log("Verified Users: " + vers);
})
Logs.find().sort({ "user.date": -1 }).then(logs => {
    logs.forEach(function (log) {
        if (!emailer.loggs.includes(log)) {
            emailer.loggs.push(log);
            backlogs = emailer.loggs;
        }
    })
    // console.log("User LOg:  " + emailer.loggs);
})
router.get('/adminpage', adminAuthenticated, (req, res) => res.render('adminpage', { requests: requests, vers: vers, loggs: backlogs }));

router.post('/adminpage', adminAuthenticated, (req, res) => {
    const { startDate, endDate } = req.body;
    if(startDate=='' || endDate==''){
        res.send('Please enter the dates!');
    }
    else{
    Logs.find({
        "user.date": { $gte: new Date(new Date(startDate).setHours(00, 00, 00)),
            $lt: new Date(new Date(endDate).setHours(23, 59, 59)) }
        // user: {
        //     date: {
        //         $gte: new Date(new Date(startDate).setHours(00, 00, 00)),
        //         $lt: new Date(new Date(endDate).setHours(23, 59, 59))
        //     }
        // }
        }).sort({ "user.date": -1 }).then(logs =>{
            emailer.loggs = [];
            logs.forEach(function (log) {
                emailer.loggs.push(log);
            })
            console.log("Queried Logs:" + emailer.loggs);
            res.render('adminpage', { requests: requests, vers: vers, loggs: emailer.loggs })
        })
    }
})

// Login Handle
router.post('/login', (req, res, next) => {
    // console.log("User: " + req);
    passport.authenticate('userlocal', {
        successRedirect: '/dashboard',
        failureRedirect: '/users/login',
        failureFlash: true
    })(req, res, next);
});

//Admin Login Handle
router.post('/adminlogin', (req, res, next) => {
    // console.log("While adminlogin " + req.user);
    passport.authenticate('adminlocal', {
        successRedirect: '/users/adminpage',
        failureRedirect: '/users/adminlogin',
        failureFlash: true
    })(req, res, next);
});

//Logout Handle
router.get('/logout', (req, res) => {
    var emailIt = emailer.emailIt
    console.log("Logout was triggered:" + emailer.emailIt)
    var pather = './modified/' + emailIt
    var deleteFolderRecursive = function (path) {
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach(function (file, index) {
                var curPath = path + "/" + file;
                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                    deleteFolderRecursive(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
        }
    };
    deleteFolderRecursive(pather)
    deleteFolderRecursive("uploads")
    req.logout();
    req.flash('success_msg', 'You are logged out!');
    res.redirect('/users/login');
});

//Admin Logout Handle
router.get('/logoutadmin', (req, res) => {
    // console.log("Loggin out admin: " + req.user);
    req.logout();
    req.flash('success_msg', 'You are logged out!');
    res.redirect('/users/adminlogin');
});

// if(user.valid==true){
//     vers.push(user);
// }
router.get('/validate/:id', (req, res) => {
    // console.log("Validated User: " + req.params.id)
    User.findByIdAndUpdate(req.params.id, { valid: true }, function (err, user) {
        if (err) {
            console.log(err);
        }
        else {
            // console.log(user);
            const index = requests.findIndex(user => user.id == req.params.id);
            if (index > -1) {
                vers.push(user);
                requests.splice(index, 1);
            }
            if(user==null){
                res.redirect('/users/adminpage');
            }
            else if(user.valid==true){
                res.redirect('/users/adminpage');
            }
            else{
            var mailOptions = {
                to: user.email,
                from: 'contact@bhumi.ngo',
                subject: 'Certificate Generator Access',
                text: 'You are receiving this because you had requested to use the Certificate Generator tool.\n\n' +
                    'This is to inform that your request has been accepted and you can now use the tool.'
            };
            transporter.sendMail(mailOptions, function (err) {
                console.log('mail sent');
            });
            // req.flash('validated_msg', 'User Approved!!');
            // res.render('adminpage');
            // console.log(requests);
            // console.log("Verified updated: " + vers);
            res.render('adminpage', { requests: requests, vers: vers, loggs: emailer.loggs });
        }
        }
    })
});

router.get('/invalidate/:id', (req, res) => {
    // console.log("Validated User: " + req.params.id)
    User.findByIdAndDelete(req.params.id, function (err, user) {
        if (err) {
            console.log(err);
        }
        else {
            const index = requests.findIndex(user => user.id == req.params.id);
            if (index > -1) {
                requests.splice(index, 1);
            }
            if(user==null){
                res.redirect('/users/adminpage');
            }
            else {
            var mailOptions = {
                to: user.email,
                from: 'contact@bhumi.ngo',
                subject: 'Certificate Generator Access',
                text: 'Your request to use the Certificate Generator tool was declined.\n\n' +
                    'Please contact the admin if you feel there has been some error.'
            };
            transporter.sendMail(mailOptions, function (err) {
                console.log('mail sent');
            });
            res.render('adminpage', { requests: requests, vers: vers, loggs: emailer.loggs });
        }
        }
    })
})


router.post('/setlimit/:id', (req, res) => {
    // console.log("Validated User: " + req.params.id)
    var { lim } = req.body;
    lim = parseInt(lim, 10);
    User.findById(req.params.id, function (err, user) {
        if (err) {
            console.log(err);
        }
        else {
            user.limit += lim;
            console.log("User details: " + user);
            console.log("Selected one: " + user.name);
            console.log("New User limit: " + user.limit);
            user.save()
            const i = vers.findIndex(user => user.id == req.params.id);
            if (i > -1) {
                vers[i].limit = user.limit;
            }
            res.render('adminpage', { requests: requests, vers: vers, loggs: emailer.loggs });
        }
    })
});

router.post('/more/:id', (req,res) => {
    Mails.find({mailID: req.params.id}, function(err, mail) {
        if(err){
            console.log(err);
        }
        else {
            console.log("QUERY: ", mail);
            res.render('mailLogs', { mail: mail });
        }
    })
})

// router.post('/getfile/:id', (req, res) => {
//     Mails.find({mailID: req.params.id}, function(err, mail) {
//         if(err){
//             console.log(err);
//         }
//         else {
//             var wb = xlsx.utils.book_new();
//             wb.Props = {
//                 Title: "Mail Logs"
//             }
//             wb.SheetNames.push("Logs");
//             var ws_data = mail[0].mails;
//             var ws = xlsx.utils.aoa_to_sheet(ws_data);
//             wb.Sheets["Logs"] = ws;

//             var wbout = xlsx.write(wb, {bookType: 'xlsx', type: 'binary'})
//         }
//     })
// })

// FORGOT PASSWORD
router.get('/forgot', function (req, res) {
    res.render('forgot');
});

router.post('/forgot', function (req, res, next) {
    async.waterfall([
        function (done) {
            crypto.randomBytes(20, function (err, buf) {
                var token = buf.toString('hex');
                done(err, token);
            });
        },
        function (token, done) {
            User.findOne({ email: req.body.email }, function (err, user) {
                if (!user) {
                    req.flash('error_msg', 'No account with that email address exists.');
                    return res.redirect('/users/forgot');
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                user.save(function (err) {
                    done(err, token, user);
                });
            });
        },
        function (token, user, done) {
            var mailOptions = {
                to: user.email,
                from: 'contact@bhumi.ngo',
                subject: 'Certificate Generator Password Reset',
                text: 'You are receiving this because you have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'http://' + req.headers.host + '/users/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            transporter.sendMail(mailOptions, function (err) {
                console.log('mail sent');
                req.flash('success_msg', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
                done(err, 'done');
            });
        }
    ], function (err) {
        if (err) return next(err);
        res.redirect('/users/forgot');
    });
});

router.get('/reset/:token', function (req, res) {
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
        if (!user) {
            req.flash('error_msg', 'Password reset token is invalid or has expired.');
            return res.redirect('/users/forgot');
        }
        res.render('reset', { token: req.params.token });
    });
});

router.post('/reset/:token', function (req, res) {
    async.waterfall([
        function (done) {
            User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
                if (!user) {
                    req.flash('error_msg', 'Password reset token is invalid or has expired.');
                    return res.redirect('/users/forgot');
                }
                else if (req.body.password === req.body.confirm) {
                    user.resetPasswordToken = undefined;
                    user.resetPasswordExpires = undefined;
                    bcrypt.genSalt(10, (err, salt) =>
                        bcrypt.hash(req.body.password, salt, (err, hash) => {
                            if (err) throw err;

                            user.password = hash;

                            //Save User
                            user.save()
                                .then(user => {
                                    req.flash('success_msg', 'Your Password has been updated!');
                                    res.redirect('/users/login');
                                })
                                .catch(err => console.log(err));
                        }));
                }
                else {
                    req.flash("error_msg", "Passwords do not match.");
                    res.redirect('back');
                }
            });
        }
        //   function(user, done) {
        //     var smtpTransport = nodemailer.createTransport({
        //         host: 'smtp.gmail.com',
        //         port: 465,
        //         auth: {
        //           user: 'enter your email',
        //           pass: 'enter your password'
        //         }
        //     });
        //     var mailOptions = {
        //       to: user.email,
        //       from: 'enter your email',
        //       subject: 'Your password has been changed',
        //       text: 'Hello,\n\n' +
        //         'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
        //     };
        //     smtpTransport.sendMail(mailOptions, function(err) {
        //       req.flash('success_msg', 'Success! Your password has been changed.');
        //       done(err);
        //     });
        //   }
    ], function (err) {
        res.redirect('/');
    });
});

module.exports = router
module.exports.vers = vers
