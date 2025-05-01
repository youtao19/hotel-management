"use strict";
const isAuthenticated = function () {
    return this.session && this.session.authenticated;
};

const login = function (params, callback) {
    //login will be a method attached on req object.
    const req = this;
    if (!callback) {
        //return a promise
        return new Promise((resolve, reject) => {
            try {
                if (!params.account.id) {
                    reject("account info returned from db misssing _id");
                } else {
                     // regenerate the session, which is good practice to help
                    // guard against forms of session fixation
                    req.session.regenerate(function (err) {
                        if(err){
                            reject(err);
                        } else {
                            req.session.account = params.account;
                            req.session.authenticated = true;
                             // save the session before redirection to ensure page
                            // load does not happen before session is saved
                            req.session.save(function (err){
                                if(err){
                                    reject(err);
                                } else {
                                    resolve(null);
                                }
                            });
                        }
                    });
                }
            } catch (e) {
                return reject(e);
            }
        });
    } else {
        try {
            req.session.regenerate(function (err) {
                if(err){
                    callback(err);
                } else {
                    req.session.account = params.account;
                    req.session.authenticated = true;

                    req.session.save(function (err){
                        if(err){
                            callback(err);
                        } else {
                            callback(null);
                        }
                    });
                }
            });
        } catch (e) {
            return callback(e);
        }
    }
};

const logout = function (callback) {
    //logout will be a method attached on req object
    const req = this;
    if (!callback) {
        //return a promise
        return new Promise((resolve, reject) => {
            try {
                delete req.session.account;
                delete req.session.authenticated;
                req.session.destroy(function (err) {
                    if (err) {
                        return reject(err);
                    } else {
                        return resolve(null);
                    }
                });
            } catch (e) {
                return reject(e);
            }
        });
    } else {
        try {
            delete req.session.account;
            delete req.session.authenticated;
            req.session.destroy(function (err) {
                if (err) {
                    return callback(err);
                } else {
                    return callback(null);
                }
            });
        } catch (e) {
            return callback(e);
        }
    }
};

function authenticationMiddleware(req, res, next) {
    req.login = login;
    req.logout = logout;
    req.isAuthenticated = isAuthenticated;
    next();
}
module.exports.authenticationMiddleware = authenticationMiddleware;

const ensureAuthenticated = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json();
};
module.exports.ensureAuthenticated = ensureAuthenticated;

