// server.js
const http = require("http");
const app = require("./app");
const setup = require("./appSettings/setup");
const posgreDB = require("./database/postgreDB/pg");
const redisDB = require("./database/redis/redis");
const emailJob = require("./modules/emailSetup");

const webServer = http.createServer(app);

async function bootup() {
  // 初始化数据库
  await posgreDB.initializeHotelDB();

  // 初始化Redis连接
  redisDB.initialize();
  console.log('Redis连接已初始化');

  // 异步测试邮箱连接，不阻塞服务器启动
  emailJob.testConnection().catch(err => {
    console.log('邮箱连接测试失败，但不影响服务器启动:', err.message);
  });

  const port = setup.port;
  webServer.listen(port, "0.0.0.0", () => {
    console.info(`The web server is running in ${setup.env} mode Listening on 0.0.0.0 with port ${port}`);
  });
}

bootup();
