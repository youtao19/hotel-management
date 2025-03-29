"use strict";
const express = require("express");
const { fork } = require('child_process');
const setup = require("./appSettings/setup");
const workerStatus = require("./backend/modules/workerStatus");
let app = express();
app.disable('x-powered-by');
if (setup.env === "dev") {
  //for development, we need this to serve index.html for non api url
  //for production, we do not need this since front end is served by lb
  //for production, we can not have this if we need to have mrsk healthcheck to work
  const history = require('connect-history-api-fallback');
  const cors = require('cors');
  app.use(cors({
    origin: 'http://localhost:8080', // Update with your frontend origin
    credentials: true, 
  }));
  app.use(history());
}
const webServer = require("http").Server(app);
const emailJob = require("./backend/modules/emailSetup");
const path = require("path");
const session = require("express-session");

const posgreDB = require("./backend/database/postgreDB/pg");
const redisDB = require("./backend/database/redis/redis");
let RedisStore = require("connect-redis")(session);
let staticFileRoot = path.join(__dirname, "front-end", "build");
if (setup.env === "dev") {
  staticFileRoot = path.join(__dirname, "front-end", "public");
}

async function bootup() {
  redisDB.initialize();
  const redisClient = redisDB.getClient();
  //this session options is for production use
  //we need to set express app to trust proxy with 1
  //this means the app has one layer of reverse-proxy in front of it.
  //for dev, we need to change cookie.secure to false
  const sessionOptions = {
    name: setup.appName + ".sid",
    store: new RedisStore({ client: redisClient }),
    secret: setup.sessionSecret,
    resave: false,
    rolling: false,
    cookie: {
      secure: false,
      maxAge: setup.cookieMaxAge,
      sameSite: "none"
    },
    saveUninitialized: false,
  };

 
  if (setup.env != "dev") {
    sessionOptions.proxy = true;
    app.set("trust proxy", true);
    sessionOptions.cookie.sameSite = true;
  }

  app.use(session(sessionOptions));
  const authtication = require("./backend/modules/authentication");
  app.use(authtication.authenticationMiddleware);
  app.use(express.json({
    limit: setup.reqSizeLimit,
    strict: false,
  }));
  app.use(express.urlencoded({ extended: true, limit: setup.reqSizeLimit }));
  app.use(express.text({ limit: setup.reqSizeLimit }));

  const userRoute = require("./backend/routes/userRoute");
  app.use("/api/user", userRoute);

  const authRoute = require("./backend/routes/authRoute");
  app.use("/api/auth", authRoute);

  app.use(express.static(staticFileRoot));

  app.get("/api/hup", (req, res) => {
    return res.status(200).json({ ok: true });
  });
  //catch all other unknown url here.
  app.all("/", function (req, res) {
    console.log(`req route not found with url : ${req.originalUrl}\nreq ip is : ${req.ip}`);
    res.status(404).json();
  });

  //setup posgreDB
  //Comment tearDown if you want to persist database storage
  //await emailJob.testConnection();
  //await posgreDB.tearDownPostgreDB();
  await posgreDB.initializePostgreDB();
  const port = setup.port;
  webServer.listen(port, "0.0.0.0", () => {
    console.info(`The web server is running in ${setup.env} mode Listening on 0.0.0.0 with port ${port}`);
  });
}

bootup();
