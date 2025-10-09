"use strict";
const redisDB = require("../database/redis/redis");

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
        return new Promise(async (resolve, reject) => {
            try {
                // 保存 sessionID 用于日志和 Redis 删除
                const sessionID = req.sessionID;
                const redis = redisDB.getClient();

                // 删除 session 属性
                delete req.session.account;
                delete req.session.authenticated;

                // 销毁 session，这会从 Redis 中删除
                req.session.destroy(async function (err) {
                    if (err) {
                        console.error(`登出失败: session ${sessionID} 销毁出错:`, err);
                    } else {
                        console.log(`session.destroy() 完成: ${sessionID}`);
                    }

                    // 显式从 Redis 中删除 session，确保清理完成
                    // connect-redis 使用 'sess:' 前缀（在 app.js 中配置）
                    try {
                        if (redis && sessionID) {
                            const redisKey = 'sess:' + sessionID;
                            const deleted = await redis.del(redisKey);
                            if (deleted > 0) {
                                console.log(`登出成功: 已从 Redis 中显式删除 session ${sessionID}`);
                            } else {
                                console.log(`Redis 中未找到 session ${sessionID}，可能已被 destroy() 删除`);
                            }
                        }
                    } catch (redisErr) {
                        console.error(`从 Redis 删除 session 时出错:`, redisErr);
                    }

                    // 无论如何都返回成功，因为前端需要清理状态
                    return resolve(null);
                });
            } catch (e) {
                console.error('登出异常:', e);
                return reject(e);
            }
        });
    } else {
        try {
            // 保存 sessionID 用于日志和 Redis 删除
            const sessionID = req.sessionID;
            const redis = redisDB.getClient();

            // 删除 session 属性
            delete req.session.account;
            delete req.session.authenticated;

            // 销毁 session，这会从 Redis 中删除
            req.session.destroy(async function (err) {
                if (err) {
                    console.error(`登出失败: session ${sessionID} 销毁出错:`, err);
                } else {
                    console.log(`session.destroy() 完成: ${sessionID}`);
                }

                // 显式从 Redis 中删除 session，确保清理完成
                try {
                    if (redis && sessionID) {
                        const redisKey = 'sess:' + sessionID;
                        const deleted = await redis.del(redisKey);
                        if (deleted > 0) {
                            console.log(`登出成功: 已从 Redis 中显式删除 session ${sessionID}`);
                        } else {
                            console.log(`Redis 中未找到 session ${sessionID}，可能已被 destroy() 删除`);
                        }
                    }
                } catch (redisErr) {
                    console.error(`从 Redis 删除 session 时出错:`, redisErr);
                }

                // 无论如何都返回成功
                return callback(null);
            });
        } catch (e) {
            console.error('登出异常:', e);
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

