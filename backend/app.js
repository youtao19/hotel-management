"use strict";
const express = require("express");
const setup = require("./appSettings/setup");
const posgreDB = require("./database/postgreDB/pg");
const authtication = require("./modules/auth/auth.middleware");
const RedisDb = require('./database/redis/redis');
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
// JWT 走 Authorization 头，不依赖 cookie，无需 credentials，保留以兼容历史请求
app.use(cors({
  origin: ['http://localhost:9011', 'http://localhost:9000']
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




// 初始化 Redis 客户端（验证码、登录限流仍依赖 Redis）并挂载路由的函数
async function initializeRoutes() {
    await RedisDb.initialize();

    // Bearer token 解析中间件：解析成功写 req.account，失败不拦截，由 ensureAuthenticated 守卫
    app.use(authtication.authenticationMiddleware);

    console.log('认证中间件已初始化');

    // 公开入口：员工认证、健康检查、外部渠道/插件回调
    const userRoute = require("./modules/auth/authUser.routes");
    app.use("/api/user", userRoute);

    const authRoute = require("./modules/auth/auth.routes");
    app.use("/api/auth", authRoute);

    app.get("/api/hup", (req, res) => res.status(200).json({ ok: true }));

    // 外部入口（自有签名鉴权，不走员工 JWT）
    const otaRoute = require("./routes/ota");
    app.use("/ota", otaRoute);

    const douyinExternalRoute = require("./modules/douyin/external/external.routes");
    app.use("/douyin", douyinExternalRoute);

    const pluginRoute = require("./routes/plugin/plugin-order.routes");
    app.use("/api/plugin", pluginRoute);

    const pluginRoomTypeRoute = require("./routes/plugin/plugin-room-types.api");
    app.use("/api/plugin/room-types", pluginRoomTypeRoute);

    const pluginRoomTypeMappingRoute = require("./routes/plugin/room-map/room-map.routes");
    app.use("/api/plugin/room-type-mapping", pluginRoomTypeMappingRoute);

    // 员工 JWT 鉴权守卫：所有后续 /api 业务路由需要 Bearer token
    // 测试和真实环境使用同一套 JWT 校验逻辑；集成测试通过 tools.js 的 authHeader() 或 authedRequest() 注入 token
    app.use("/api", authtication.ensureAuthenticated);

    // 受保护后台业务路由
    const orderCreateRoutes = require("./modules/order-create/orderCreate.routes");
    app.use("/api/orders", orderCreateRoutes);

    const orderManageRoutes = require("./modules/order-manage/orderManage.routes");
    app.use("/api/orders", orderManageRoutes);
    app.use("/api/rooms", orderManageRoutes.roomRoutes);

    const roomStatusRoutes = require("./modules/room-status/roomStatus.routes");
    app.use("/api/rooms", roomStatusRoutes);

    const roomManageRoutes = require("./modules/room-manage/roomManage.routes");
    app.use("/api/rooms", roomManageRoutes);

    app.use("/api/room-types", roomManageRoutes.roomTypeRoutes);

    const ratePlanRoute = require("./modules/douyin/rate-plan/ratePlan.routes");
    app.use("/api/rate-plans", ratePlanRoute);

    const douyinRoomTypeMappingRoute = require("./modules/douyin/room-type-mapping/roomTypeMapping.routes");
    app.use("/api/douyin/room-type-mapping", douyinRoomTypeMappingRoute);

    const douyinAriNotifyRoute = require("./modules/douyin/availability/ariNotify.routes");
    app.use("/api/douyin/ari-notify", douyinAriNotifyRoute);

    const billRoutes = require("./modules/bill/bill.routes");
    app.use("/api/bills", billRoutes);

    const reviewRoute = require("./modules/review/review.routes");
    app.use("/api/reviews", reviewRoute);

    const shiftHandoverRoutes = require("./modules/shift-handover/shiftHandover.routes");
    app.use("/api/handover", shiftHandoverRoutes);

    const incomeStatisticsRoutes = require("./modules/income-statistics/incomeStatistics.routes");
    app.use("/api/revenue", incomeStatisticsRoutes);

    const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
    app.use("/api/dashboard/memos", dashboardRoutes);

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
module.exports.initializeSession = initializeRoutes;
