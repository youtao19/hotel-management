// app.js
"use strict";
const express = require("express");
const path = require("path");
const session = require("express-session");
const setup = require("./appSettings/setup");
const posgreDB = require("./backend/database/postgreDB/pg");
const authtication = require("./backend/modules/authentication");

let app = express();
app.disable('x-powered-by');

if (setup.env === "dev") {
  const history = require('connect-history-api-fallback');
  const cors = require('cors');
  app.use(cors({
    origin: ['http://localhost:9000', 'http://localhost:9001'],
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(history());
}

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

app.use(express.json({ limit: setup.reqSizeLimit, strict: false }));
app.use(express.urlencoded({ extended: true, limit: setup.reqSizeLimit }));
app.use(express.text({ limit: setup.reqSizeLimit }));

// 引入并挂载路由
const userRoute = require("./backend/routes/userRoute");
const authRoute = require("./backend/routes/authRoute");
const orderRoute = require("./backend/routes/orderRoute");
const roomRoute = require("./backend/routes/roomRoute");
const roomTypeRoute = require("./backend/routes/roomTypeRoute");
const billRoute = require("./backend/routes/billRoute");
const shiftHandoverRoute = require("./backend/routes/shiftHandoverRoute");
const revenueRoute = require("./backend/routes/revenueRoute");

app.use("/api/user", userRoute);
app.use("/api/auth", authRoute);
app.use("/api/orders", orderRoute);
app.use("/api/rooms", roomRoute);
app.use("/api/room-types", roomTypeRoute);
app.use("/api/bills", billRoute);
app.use("/api/shift-handover", shiftHandoverRoute);
app.use("/api/revenue", revenueRoute);

app.get("/api/hup", (req, res) => res.status(200).json({ ok: true }));

app.all("/", function (req, res) {
  console.log(`req route not found with url : ${req.originalUrl}\nreq ip is : ${req.ip}`);
  res.status(404).json();
});

module.exports = app;
