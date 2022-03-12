const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

//Load User Model
const User = require('../models/User');
// const Admin = require('../models/Admin');

module.exports = function(passport) {
    passport.use( 'userlocal',
        new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
            //Match User
            User.findOne({ email: email })
                .then(user => {
                    if(!user) {
                        return done(null, false, { message: 'This email is not registered.' });
                    }
                    else if(!user.valid) {
                        return done(null, false, { message: 'Your account is not yet validated.' });
                    }


                    //Match Password, using bcrypt here to decrypt the hashed password
                    bcrypt.compare(password, user.password, (err, isMatch) => {
                        if(err) throw err;

                        if(isMatch){
                            return done(null, user);
                        } else{
                            return done(null, false, { message: 'Password Incorrect' });
                        }
                    });
                })
                .catch(err => console.log(err));
        })
    );

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });
      
    passport.deserializeUser((id, done) => {
        User.findById(id, (err, user) => {
          done(err, user);
        });
    });


    passport.use( 'adminlocal',
        new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
            //Match User
            User.findOne({ email: email })
                .then(user => {
                    if(!user) {
                        return done(null, false, { message: 'This email is not registered.' });
                    }
                    else if(!user.admin) {
                        return done(null, false, { message: 'Your account does not have Admin access.' });
                    }
                    // else if(!user.admin) {
                    //     return done(null, false, { message: 'This is for admins only.' });
                    // }

                    //Match Password, using bcrypt here to decrypt the hashed password
                    bcrypt.compare(password, user.password, (err, isMatch) => {
                        if(err) throw err;

                        if(isMatch){
                            return done(null, user);
                        } else{
                            return done(null, false, { message: 'Password Incorrect' });
                        }
                    });
                })
                .catch(err => console.log(err));
        })
    );

    passport.serializeUser((user, done) => {
        done(null, user.id);
      });
      
    passport.deserializeUser((id, done) => {
        User.findById(id, (err, user) => {
          done(err, user);
        });
    });


    //   passport.use( 'adminlocal',
    //     new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    //         //Match Admin
    //         Admin.findOne({ email: email })
    //             .then(admin => {
    //                 if(!admin) {
    //                     return done(null, false, { message: 'This email is not registered.' });
    //                 }
  
    //                 //Match Password, using bcrypt here to decrypt the hashed password
    //                 bcrypt.compare(password, admin.password, (err, isMatch) => {
    //                     if(err) throw err;
  
    //                     if(isMatch){
    //                         return done(null, admin);
    //                     } else{
    //                         return done(null, false, { message: 'Password Incorrect' });
    //                     }
    //                 });
    //             })
    //             .catch(err => console.log(err));
    //     })
    // );
  
    // passport.serializeUser((admin, done) => {
    //     done(null, admin.id);
    // });
      
    // passport.deserializeUser((id, done) => {
    //     Admin.findById(id, (err, admin) => {
    //       done(err, admin);
    //     });
    // });
}
