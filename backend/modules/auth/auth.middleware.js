"use strict";

const isAuthenticated = function () {
  return this.session && this.session.authenticated;
};

const login = function (params, callback) {
  const req = this;
  if (!callback) {
    return new Promise((resolve, reject) => {
      try {
        if (!params.account.id) {
          reject("account info returned from db misssing _id");
        } else {
          // 登录后重建 session，避免沿用登录前的 session id。
          req.session.regenerate(function (err) {
            if (err) {
              reject(err);
            } else {
              req.session.account = params.account;
              req.session.authenticated = true;
              // 保存完成后再响应，避免前端跳转时 cookie 尚未落库。
              req.session.save(function (err) {
                if (err) {
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
  }

  try {
    req.session.regenerate(function (err) {
      if (err) {
        callback(err);
      } else {
        req.session.account = params.account;
        req.session.authenticated = true;

        req.session.save(function (err) {
          if (err) {
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
};

const logout = function (callback) {
  const req = this;
  if (!callback) {
    return new Promise((resolve, reject) => {
      try {
        delete req.session.account;
        delete req.session.authenticated;
        req.session.destroy(function (err) {
          if (err) {
            return reject(err);
          }
          return resolve(null);
        });
      } catch (e) {
        return reject(e);
      }
    });
  }

  try {
    delete req.session.account;
    delete req.session.authenticated;
    req.session.destroy(function (err) {
      if (err) {
        return callback(err);
      }
      return callback(null);
    });
  } catch (e) {
    return callback(e);
  }
};

function authenticationMiddleware(req, res, next) {
  req.login = login;
  req.logout = logout;
  req.isAuthenticated = isAuthenticated;
  next();
}

const ensureAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json();
};

module.exports = {
  authenticationMiddleware,
  ensureAuthenticated
};
