// server.js
const path = require('path')

const envFile =
  process.env.NODE_ENV === 'test'
    ? path.resolve(__dirname, '../.env.test')
    : path.resolve(__dirname, '../dev.env')

require('dotenv').config({ path: envFile })

const http = require("http");
const app = require("./app");
const setup = require("./appSettings/setup");
const posgreDB = require("./database/postgreDB/pg");
const webServer = http.createServer(app);
const emailSetup = require("./modules/emailSetup");
const { startAutoBillJob } = require("./appSettings/schedulers/autoBillJob");

async function bootup() {
  // 初始化数据库
  await posgreDB.initializePostgreDB();

  // 初始化 Redis 和 Session（必须在处理请求前完成）
  await app.initializeSession();

  await emailSetup.testConnection();

  startAutoBillJob();


  const port = setup.port;
  webServer.listen(port, "0.0.0.0", () => {
    console.info(`The web server is running in ${setup.env} mode Listening on 0.0.0.0 with port ${port}`);
  });
}

bootup();
