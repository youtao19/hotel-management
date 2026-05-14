"use strict";

const express = require("express");
const controller = require("./auth.controller");

const router = express.Router();

// 注册员工账号。
router.post("/signup", controller.signup);

// 员工登录。
router.post("/login", controller.login);

// 向新注册用户发送验证邮件。
router.post("/send-email-verification", controller.sendEmailVerification);

// 验证邮箱。
router.post("/email-verify", controller.verifyEmail);

// 检查注册邮箱是否已存在。
router.get("/check/email/:email", controller.checkEmail);

// 发送密码重置邮件，保留历史接口名。
router.post("/send-preset-email", controller.sendResetPasswordEmail);

// 重置密码。
router.post("/reset-pw", controller.resetPassword);

// 检查密码重置 code 是否有效。
router.get("/check/reset-code/:code", controller.checkResetCode);

module.exports = router;
