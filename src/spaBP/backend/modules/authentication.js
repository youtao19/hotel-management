"use strict";
const passport = require('passport'); // 引入 Passport.js 用于认证
const LocalStrategy = require('passport-local').Strategy; // 引入 Passport 本地策略
const session = require('express-session'); // 引入 express-session 用于会话管理
const RedisStore = require("connect-redis").default; // 引入 connect-redis 用于将 session 存储在 Redis 中
const redisDB = require("../database/redis/redis"); // 引入 Redis 数据库连接模块
const setup = require("../../appSettings/setup"); // 引入应用设置

// 初始化 Passport
function initPassport(app) {
    // 配置 express-session 中间件
    app.use(session({
        // 使用 Redis 存储 session
        store: new RedisStore({ client: redisDB.getClient() }), // 创建 RedisStore 实例
        secret: setup.sessionSecret, // 用于签名 session ID cookie 的密钥，必需
        resave: false, // 强制 session 即使没有修改也保存回存储区，建议 false
        saveUninitialized: false, // 强制未初始化的 session 保存到存储区，建议 false
        cookie: { // session cookie 设置
            secure: setup.isProduction, // 在生产环境中应设为 true，只通过 HTTPS 发送 cookie
            httpOnly: true, // 阻止客户端 JavaScript 访问 cookie，增强安全性
            maxAge: setup.sessionMaxAge // cookie 有效期（毫秒）
        }
    }));

    // 初始化 Passport 中间件，必须在 express-session 之后
    app.use(passport.initialize());
    // 使用 Passport session 中间件，将会话数据与 Passport 用户关联
    app.use(passport.session());

    // 配置 Passport 本地策略 (这里只是框架，实际的验证逻辑在 authRoute.js 中处理)
    // passport.use(new LocalStrategy(
    //     {
    //         usernameField: 'email', // 指定用户名(邮箱)字段
    //         passwordField: 'pw' // 指定密码字段
    //     },
    //     async (email, password, done) => {
    //         // 这里的验证逻辑通常在登录路由中完成，因为需要访问数据库和 bcrypt
    //         // 这里仅作示例，实际验证在 /login 路由中
    //         console.log("LocalStrategy 被调用，但不应在这里处理验证逻辑");
    //         // 如果验证逻辑放在这里，需要查询数据库、比较密码等
    //         // return done(null, user); // 成功
    //         // return done(null, false, { message: 'Incorrect username or password.' }); // 失败
    //         // return done(err); // 出错
    //     }
    // ));

    // 序列化用户：决定将哪些用户信息存储到 session 中
    passport.serializeUser((params, done) => {
        // params 包含 account 对象 { id, name, email }
        // 通常只存储用户的唯一标识符，如 id
        done(null, params.account); // 将整个 account 对象存入 session
    });

    // 反序列化用户：根据 session 中存储的信息，查找并恢复完整的用户信息
    passport.deserializeUser(async (account, done) => {
        // account 是 serializeUser 中存入 session 的对象
        // 这里可以直接使用 session 中的 account 对象，因为已经包含了需要的信息
        // 如果只存储了 id，则需要在此处查询数据库获取完整用户信息
        // try {
        //     const user = await findUserById(id); // 假设有此函数
        //     done(null, user);
        // } catch (err) {
        //     done(err);
        // }
        done(null, account); // 直接将 session 中的 account 对象作为 req.user 返回
    });

    // 扩展 req 对象，添加 login 和 logout 方法
    app.use((req, res, next) => {
        // req.login() 是 Passport 提供的用于建立登录会话的方法
        // 我们在这里封装一层，方便在路由中使用
        req.login = async (params) => {
            return new Promise((resolve, reject) => {
                // 调用 Passport 的 req.logIn 方法
                req.logIn(params, (err) => {
                    if (err) {
                        console.error("登录时出错:", err);
                        return reject(err);
                    }
                    console.log("用户已登录，Session ID:", req.sessionID);
                    console.log("Session 内容:", req.session);
                    resolve();
                });
            });
        };

        // req.logout() 是 Passport 提供的用于销毁登录会话的方法
        req.logout = async () => {
            return new Promise((resolve, reject) => {
                // 调用 Passport 的 req.logout 方法
                req.logout((err) => {
                    if (err) {
                        console.error("登出时出错:", err);
                        return reject(err);
                    }
                    // 可选：销毁 session
                    req.session.destroy((destroyErr) => {
                        if (destroyErr) {
                            console.error("销毁 Session 时出错:", destroyErr);
                            return reject(destroyErr);
                        }
                        console.log("用户已登出，Session 已销毁");
                        resolve();
                    });
                });
            });
        };
        next();
    });
}

// 认证中间件：检查用户是否已登录
function isAuthenticated(req, res, next) {
    // Passport 会在反序列化成功后将用户信息附加到 req.user
    if (req.isAuthenticated()) { // isAuthenticated() 是 Passport 提供的检查方法
        return next(); // 用户已登录，继续处理请求
    }
    // 用户未登录，返回 401 Unauthorized
    res.status(401).json({ message: '未授权' });
}

module.exports = {
    initPassport, // 导出初始化函数
    isAuthenticated // 导出认证检查中间件
};