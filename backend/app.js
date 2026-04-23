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

/**
 * 保留原始请求体，供渠道签名校验使用。
 * @param {import('express').Request} req 请求对象
 * @param {import('express').Response} _res 响应对象
 * @param {Buffer} buf 原始缓冲区
 * @returns {void}
 */
function captureRawBody(req, _res, buf) {
  req.rawBody = buf && buf.length ? buf.toString('utf8') : '';
}

// 静态文件路径：Docker 环境统一使用 ./frontend_dist
const staticFileRoot = path.join(__dirname, 'frontend_dist');

const cors = require('cors');

// 允许来自测试端口和开发端口的访问
app.use(cors({
  origin: ['http://localhost:9011', 'http://localhost:9000'],
  credentials: true
}));

// 解析中间件
app.use(express.json({
  limit: setup.reqSizeLimit,
  strict: false,
  verify: captureRawBody
}));

app.use(express.urlencoded({
  extended: true,
  limit: setup.reqSizeLimit,
  verify: captureRawBody
}));

app.use(express.text({
  limit: setup.reqSizeLimit,
  verify: captureRawBody
}));




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

    const ratePlanRoute = require("./routes/ratePlanRoute");
    app.use("/api/rate-plans", ratePlanRoute);

    const douyinRoomTypeMappingRoute = require("./routes/douyinRoomTypeMappingRoute");
    app.use("/api/douyin/room-type-mapping", douyinRoomTypeMappingRoute);

    const douyinExternalRoute = require("./routes/douyinExternalRoute");
    app.use("/douyin", douyinExternalRoute);

    const billRoute = require("./routes/billRoute");
    app.use("/api/bills", billRoute);

    const reviewRoute = require("./routes/reviewRoute");
    app.use("/api/reviews", reviewRoute);

    const HandoverRoute = require("./routes/handoverRoute");
    app.use("/api/handover", HandoverRoute);

    const revenueRoute = require("./routes/revenueRoute");
    app.use("/api/revenue", revenueRoute);

    const dashboardMemoRoute = require("./routes/dashboardMemoRoute");
    app.use("/api/dashboard/memos", dashboardMemoRoute);

    const otaRoute = require("./routes/ota");
    app.use("/ota", otaRoute);

    const pluginRoute = require("./routes/plugin/plugin-order.routes");
    app.use("/api/plugin", pluginRoute);

    const pluginRoomTypeRoute = require("./routes/plugin/plugin-room-types.api");
    app.use("/api/plugin/room-types", pluginRoomTypeRoute);

    const pluginRoomTypeMappingRoute = require("./routes/plugin/room-map/room-map.routes");
    app.use("/api/plugin/room-type-mapping", pluginRoomTypeMappingRoute);

    // 只注册当前已重建并可验签的抖音外部回调入口；历史 /api/douyin/* 模块仍保持停用。
    // 本地售卖套餐 CRUD 已迁移到 /api/rate-plans，不依赖历史抖音路由。

    app.get("/api/hup", (req, res) => res.status(200).json({ ok: true }));

    // ✅ SPA History Fallback - 必须在静态文件服务之前
    const history = require('connect-history-api-fallback');
    app.use(history({
      verbose: setup.env === "dev",
      rewrites: [
        // API 路由不重写
        { from: /^\/api\/.*$/, to: context => context.parsedUrl.path }
      ]
    }));

    // ✅ 静态文件服务 - 放在 history fallback 之后
    app.use(express.static(staticFileRoot));

    console.log('所有路由已注册');
}

module.exports = app;
module.exports.initializeSession = initializeSession;
