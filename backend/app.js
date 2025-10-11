"use strict";
const express = require("express");
const session = require("express-session");
const setup = require("./appSettings/setup");
const posgreDB = require("./database/postgreDB/pg");
const authtication = require("./modules/authentication");
const RedisDb = require('./database/redis/redis');
const { RedisStore } = require("connect-redis");
const path = require("path");

let app = express();

app.disable('x-powered-by');

const staticFileRoot = path.join(__dirname, '..', 'frontend', 'dist', 'spa');

// 解析中间件
app.use(express.json({
  limit: setup.reqSizeLimit,
  strict: false
}));

app.use(express.urlencoded({
  extended: true,
  limit: setup.reqSizeLimit
}));

app.use(express.text({
  limit: setup.reqSizeLimit
}));

if (setup.env === "dev") {
  const history = require('connect-history-api-fallback');
  const cors = require('cors');
  app.use(cors({
    origin: ['http://localhost:9000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  }));
  app.use(history());
}

// 初始化 session 和 Redis store 的函数
async function initializeSession() {
    const redisClient = await RedisDb.initialize();

    const sessionOptions = {
        name: setup.appName + ".sid",
        store: new RedisStore({ client: redisClient }),
        secret: setup.sessionSecret,
        resave: false,
        rolling: false,
        cookie: {
            secure: setup.env === "production", // ✅ 只有生产环境才用 true
            maxAge: setup.cookieMaxAge,
            sameSite: setup.env === "production" ? "none" : "lax", // ✅ 生产环境用 none，其他用 lax
            httpOnly: true // ✅ 添加安全性
        },
        saveUninitialized: false,
    };

    if (setup.env === "production") {
        sessionOptions.proxy = true;
        app.set("trust proxy", true);
    }

    // ✅ 先注册 session 和 authentication 中间件
    app.use(session(sessionOptions));
    app.use(authtication.authenticationMiddleware);

    console.log('Session 中间件已初始化');

    // ✅ 然后注册所有路由 (确保在中间件之后)
    const userRoute = require("./routes/userRoute");
    app.use("/api/user", userRoute);

    const authRoute = require("./routes/authRoute");
    app.use("/api/auth", authRoute);

    const orderRoute = require("./routes/orderRoute");
    app.use("/api/orders", orderRoute);

    const roomRoute = require("./routes/roomRoute");
    app.use("/api/rooms", roomRoute);

    const roomTypeRoute = require("./routes/roomTypeRoute");
    app.use("/api/room-types", roomTypeRoute);

    const billRoute = require("./routes/billRoute");
    app.use("/api/bills", billRoute);

    const reviewRoute = require("./routes/reviewRoute");
    app.use("/api/reviews", reviewRoute);

    const HandoverRoute = require("./routes/handoverRoute");
    app.use("/api/handover", HandoverRoute);

    const revenueRoute = require("./routes/revenueRoute");
    app.use("/api/revenue", revenueRoute);

    const revenueStatisticsRoute = require("./routes/revenueStatisticsRoute");
    app.use("/api/revenue-statistics", revenueStatisticsRoute);

    app.use(express.static(staticFileRoot));

    app.get("/api/hup", (req, res) => res.status(200).json({ ok: true }));

    app.all("/", function (req, res) {
      console.log(`req route not found with url : ${req.originalUrl}\nreq ip is : ${req.ip}`);
      res.status(404).json();
    });

    console.log('所有路由已注册');
}

module.exports = app;
module.exports.initializeSession = initializeSession;
