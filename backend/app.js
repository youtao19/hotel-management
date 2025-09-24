// app.js
"use strict";
const express = require("express");
const path = require("path");
const session = require("express-session");
const setup = require("./appSettings/setup");
const posgreDB = require("./database/postgreDB/pg");
const authtication = require("./modules/authentication");

let app = express();

app.disable('x-powered-by');

// 先挂载解析中间件与会话/认证，确保后续路由能访问 req.body 和会话
app.use(express.json({ limit: setup.reqSizeLimit, strict: false }));
app.use(express.urlencoded({ extended: true, limit: setup.reqSizeLimit }));
app.use(express.text({ limit: setup.reqSizeLimit }));

const sessionOptions = {
  name: setup.appName + ".sid",
  secret: setup.sessionSecret,
  resave: false,
  rolling: false,
  cookie: {
    secure: setup.env !== "dev",
    maxAge: setup.cookieMaxAge,
    sameSite: setup.env !== "dev" ? "lax" : "none"
  },
  saveUninitialized: false,
};

if (setup.env !== "dev") {
  sessionOptions.proxy = true;
  app.set("trust proxy", true);
  sessionOptions.cookie.sameSite = "strict";
}

app.use(session(sessionOptions));
app.use(authtication.authenticationMiddleware);

if (setup.env === "dev") {
  const history = require('connect-history-api-fallback');
  const cors = require('cors');
  app.use(cors({
    origin: ['http://localhost:9000', 'http://localhost:9001'],
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  // app.use(history());

}

// 引入并挂载路由
const userRoute = require("./routes/userRoute");
const authRoute = require("./routes/authRoute");
const debugAuthRoute = require("./routes/debugAuthRoute");
const orderRoute = require("./routes/orderRoute");
const roomRoute = require("./routes/roomRoute");
const roomTypeRoute = require("./routes/roomTypeRoute");
const billRoute = require("./routes/billRoute");
const reviewRoute = require("./routes/reviewRoute");
const HandoverRoute = require("./routes/handoverRoute");
const revenueRoute = require("./routes/revenueRoute");
const revenueStatisticsRoute = require("./routes/revenueStatisticsRoute");

app.use("/api/user", userRoute);
app.use("/api/auth", authRoute);
app.use("/api/debug", debugAuthRoute);
app.use("/api/orders", orderRoute);
app.use("/api/rooms", roomRoute);
app.use("/api/room-types", roomTypeRoute);
app.use("/api/bills", billRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/handover", HandoverRoute);
app.use("/api/revenue", revenueRoute);
app.use("/api/revenue-statistics", revenueStatisticsRoute);
app.get("/api/hup", (req, res) => res.status(200).json({ ok: true }));

app.all("/", function (req, res) {
  console.log(`req route not found with url : ${req.originalUrl}\nreq ip is : ${req.ip}`);
  res.status(404).json();
});

app.use(session(sessionOptions));
app.use(authtication.authenticationMiddleware);




module.exports = app;
