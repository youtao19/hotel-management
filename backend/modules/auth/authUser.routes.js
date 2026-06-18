"use strict";

const express = require("express");
const authentication = require("./auth.middleware");
const controller = require("./auth.controller");

const router = express.Router();

// 登出不要求认证，方便前端在 token 失效时也调用并清理本地 token。
router.get("/logout", controller.logout);

// /api 守卫在 app.js 已统一挂载；这里保留 ensureAuthenticated 仅保护本路由组，避免依赖全局挂载顺序。
router.use(authentication.ensureAuthenticated);

// 当前登录员工信息。
router.get("/info", controller.getCurrentUser);

// 当前登录员工的邮箱验证状态。
router.get("/check/email", controller.getCurrentUserEmailVerified);

module.exports = router;
