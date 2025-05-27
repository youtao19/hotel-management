// server.js
const http = require("http");
const app = require("./app");
const setup = require("./appSettings/setup");
const posgreDB = require("./backend/database/postgreDB/pg");

const webServer = http.createServer(app);

async function bootup() {
  await posgreDB.initializeHotelDB();
  const port = setup.port;
  webServer.listen(port, "0.0.0.0", () => {
    console.info(`The web server is running in ${setup.env} mode Listening on 0.0.0.0 with port ${port}`);
  });
}

bootup();
