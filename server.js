"use strict"; // 严格模式
const express = require("express"); // 引入Express框架
// const { fork } = require('child_process'); // 引入子进程模块，用于创建子进程
const setup = require("./appSettings/setup"); // 引入应用程序设置
// const workerStatus = require("./backend/modules/workerStatus"); // 引入工作状态模块
let app = express(); // 创建Express应用实例
app.disable('x-powered-by'); // 禁用X-Powered-By头，增强安全性
if (setup.env === "dev") {
  //for development, we need this to serve index.html for non api url
  //for production, we do not need this since front end is served by lb
  //for production, we can not have this if we need to have mrsk healthcheck to work
  // 开发环境特定配置：
  // 对于开发环境，我们需要这个来为非API URL提供index.html服务
  // 对于生产环境，我们不需要这个，因为前端由负载均衡器提供服务
  // 对于生产环境，如果需要使mrsk健康检查正常工作，我们不能有这个配置
  const history = require('connect-history-api-fallback'); // 引入connect-history-api-fallback中间件，用于处理前端路由
  const cors = require('cors'); // 引入跨域资源共享中间件
  app.use(cors({
    origin: '*', // 允许任何来源
    credentials: false // 与通配符origin兼容需要设置为false
  }));
  app.use(history()); // 使用history中间件
}
const webServer = require("http").Server(app); // 创建HTTP服务器
// const emailJob = require("./backend/modules/emailSetup"); // 引入邮件设置模块
const path = require("path"); // 引入路径处理模块
const session = require("express-session"); // 引入会话管理中间件

const posgreDB = require("./backend/database/postgreDB/pg"); // 引入PostgreSQL数据库模块
// const redisDB = require("./backend/database/redis/redis"); // 引入Redis数据库模块
// let RedisStore = require("connect-redis")(session); // 创建Redis会话存储
let staticFileRoot = path.join(__dirname, "front-end", "build"); // 设置静态文件根目录为生产环境构建目录
if (setup.env === "dev") {
  staticFileRoot = path.join(__dirname, "front-end", "public"); // 开发环境使用public目录作为静态文件根目录
}

async function bootup() { // 启动函数
  // 初始化Redis数据库
  // 暂不使用
  // redisDB.initialize(); // 初始化Redis数据库
  // const redisClient = redisDB.getClient(); // 获取Redis客户端



  //this session options is for production use
  //we need to set express app to trust proxy with 1
  //this means the app has one layer of reverse-proxy in front of it.
  //for dev, we need to change cookie.secure to false
  // 这些会话选项用于生产环境
  // 我们需要设置express应用信任代理为1
  // 这意味着应用前面有一层反向代理
  // 对于开发环境，我们需要将cookie.secure设置为false
  const sessionOptions = {
    name: setup.appName + ".sid", // 会话ID名称
    // store: new RedisStore({ client: redisClient }), // 使用Redis存储会话数据
    secret: setup.sessionSecret, // 会话密钥
    resave: false, // 不强制保存未修改的会话
    rolling: false, // 不更新会话到期时间
    cookie: {
      secure: false, // 不要求使用HTTPS
      maxAge: setup.cookieMaxAge, // Cookie最大存活时间
      sameSite: "none" // 跨站点Cookie设置
    },
    saveUninitialized: false, // 不保存未初始化的会话
  };


  if (setup.env != "dev") { // 非开发环境的特殊配置
    sessionOptions.proxy = true; // 启用代理
    app.set("trust proxy", true); // 设置Express信任代理
    sessionOptions.cookie.sameSite = true; // 设置SameSite为严格模式
  }

  app.use(session(sessionOptions)); // 使用会话中间件
  const authtication = require("./backend/modules/authentication"); // 引入认证模块
  app.use(authtication.authenticationMiddleware); // 使用认证中间件
  app.use(express.json({
    limit: setup.reqSizeLimit, // 限制JSON请求体大小
    strict: false, // 不严格解析JSON
  }));
  app.use(express.urlencoded({ extended: true, limit: setup.reqSizeLimit })); // 配置URL编码的请求体解析
  app.use(express.text({ limit: setup.reqSizeLimit })); // 配置文本请求体解析

  const userRoute = require("./backend/routes/userRoute"); // 引入用户路由模块
  const authRoute = require("./backend/routes/authRoute"); // 引入认证路由模块
  const orderRoute = require("./backend/routes/orderRoute"); // 引入订单路由

  // 添加房间和房型路由
  const roomRoute = require("./backend/routes/roomRoute"); // 引入房间路由
  const roomTypeRoute = require("./backend/routes/roomTypeRoute"); // 引入房型路由

  app.use("/api/user", userRoute); // 挂载用户API路由
  app.use("/api/auth", authRoute); // 挂载认证API路由
  app.use("/api/orders", orderRoute); // 使用订单路由

  // 注册房间和房型API路由
  app.use("/api/rooms", roomRoute); // 挂载房间API路由
  app.use("/api/room-types", roomTypeRoute); // 挂载房型API路由

  // 其他酒店管理系统路由
  // const hotelRoute = require("./backend/routes/hotelRoute");
  // const bookingRoute = require("./backend/routes/bookingRoute");
  // app.use("/api/hotel", hotelRoute);
  // app.use("/api/booking", bookingRoute);

  app.use(express.static(staticFileRoot)); // 配置静态文件服务

  app.get("/api/hup", (req, res) => { // 健康检查端点
    return res.status(200).json({ ok: true });
  });
  //catch all other unknown url here.
  // 捕获所有其他未知的URL请求
  app.all("/", function (req, res) {
    console.log(`req route not found with url : ${req.originalUrl}\nreq ip is : ${req.ip}`);
    res.status(404).json();
  });

  //setup posgreDB
  //Comment tearDown if you want to persist database storage
  // 设置PostgreSQL数据库
  // 如果你想保留数据库存储，请注释掉tearDown
  //await emailJob.testConnection();
  //await posgreDB.tearDownPostgreDB();
  await posgreDB.initializeHotelDB(); // 初始化PostgreSQL数据库
  const port = setup.port; // 获取端口配置
  webServer.listen(port, "0.0.0.0", () => { // 启动Web服务器监听
    console.info(`The web server is running in ${setup.env} mode Listening on 0.0.0.0 with port ${port}`);
  });
}

bootup(); // 执行启动函数
