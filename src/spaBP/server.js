"use strict";
const express = require("express"); // 引入 Express 框架
const cors = require("cors"); // 引入 CORS 中间件，用于处理跨域请求
const helmet = require("helmet"); // 引入 Helmet 中间件，用于设置安全相关的 HTTP 头
const morgan = require("morgan"); // 引入 Morgan 中间件，用于记录 HTTP 请求日志
const path = require("path"); // 引入 Path 模块，用于处理文件路径
const setup = require("./appSettings/setup"); // 引入应用设置
const authentication = require("./backend/modules/authentication"); // 引入认证模块
const pgDB = require("./backend/database/postgreDB/pg"); // 引入 PostgreSQL 数据库模块
const redisDB = require("./backend/database/redis/redis"); // 引入 Redis 数据库模块
const emailJob = require("./backend/modules/emailSetup"); // 引入邮件模块

// 引入路由文件
const authRoute = require("./backend/routes/authRoute");
const userRoute = require("./backend/routes/userRoute");

// 创建 Express 应用实例
const app = express();

// --- 中间件设置 ---

// 启用 CORS (允许所有来源，在生产环境中应配置更严格的规则)
app.use(cors());

// 使用 Helmet 设置安全 HTTP 头
app.use(helmet());

// 解析 JSON 请求体
app.use(express.json());
// 解析 URL 编码的请求体
app.use(express.urlencoded({ extended: true }));

// 使用 Morgan 记录 HTTP 请求日志 (dev 格式)
app.use(morgan("dev"));

// --- 数据库和认证初始化 ---

// 连接 Redis
redisDB.connectRedis();

// 初始化 Passport 和 Session
authentication.initPassport(app);

// --- 路由设置 ---

// 挂载认证相关路由
app.use("/api/auth", authRoute);
// 挂载用户相关路由 (需要认证)
app.use("/api/user", userRoute);

// --- 静态文件服务 (可选，如果前端由 Quasar 开发服务器提供) ---
// 如果需要 Node.js 服务器也提供前端静态文件
// app.use(express.static(path.join(__dirname, "../dist/spa")));
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "../dist/spa", "index.html"));
// });

// --- 错误处理中间件 (示例) ---
app.use((err, req, res, next) => {
  console.error("全局错误处理:", err.stack);
  res.status(500).send("服务器内部错误!");
});

// --- 启动服务器 ---

const PORT = setup.port || 3001; // 从设置或环境变量获取端口，默认为 3001

app.listen(PORT, async () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`);
  // 测试数据库连接
  await pgDB.testConnection();
  // 测试邮件连接
  await emailJob.testConnection();
});
