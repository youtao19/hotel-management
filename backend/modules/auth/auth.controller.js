"use strict";

const authService = require("./auth.service");
const { signAccountToken } = require("./jwt.helper");
const {
  validateCode,
  validateEmail,
  validateLogin,
  validateResetPassword,
  validateSignup
} = require("./auth.validator");

function sendValidationFailure(res, validate, body) {
  console.log(validate.errors);
  console.log(body);
  return res.status(400).json();
}

function sendServiceResult(res, result) {
  if (result.retryAfter) {
    res.set("Retry-After", String(result.retryAfter));
  }

  if (result.text) {
    return res.status(result.status).send(result.text);
  }

  if (result.end) {
    return res.status(result.status).end();
  }

  return res.status(result.status).json(result.body);
}

/**
 * 注册员工账号。
 * Phase 2 后业务流在 service，响应字段仍保持旧接口的 id/name/email。
 */
async function signup(req, res) {
  try {
    const valid = validateSignup(req.body);
    if (!valid) {
      return sendValidationFailure(res, validateSignup, req.body);
    }

    const account = await authService.signup(req.body);
    return res.status(200).json(account);
  } catch (error) {
    console.error(`some error occurred ${error}`);
    return res.status(500).json();
  }
}

/**
 * 员工登录。
 * 未验证邮箱仍按登录失败计入限流，防止绕过账号保护。
 * 登录成功后签发 JWT，前端保存到 localStorage 并作为 Bearer token 携带。
 */
async function login(req, res) {
  try {
    const valid = validateLogin(req.body);
    if (!valid) {
      return sendValidationFailure(res, validateLogin, req.body);
    }

    const result = await authService.login({
      email: req.body.email,
      pw: req.body.pw,
      ipAddr: req.ip
    });

    if (result.status === 200 && result.body) {
      result.body = { ...result.body, token: signAccountToken(result.body) };
    }

    return sendServiceResult(res, result);
  } catch (error) {
    console.error("some error occurred in login", error);
    return res.status(500).json();
  }
}

/**
 * 给已注册账号发送邮箱验证邮件。
 */
async function sendEmailVerification(req, res) {
  try {
    const valid = validateEmail(req.body);
    if (!valid) {
      return sendValidationFailure(res, validateEmail, req.body);
    }

    const result = await authService.sendEmailVerification(req.body.email);
    return sendServiceResult(res, result);
  } catch (error) {
    console.log(error);
    return res.status(500).json();
  }
}

/**
 * 根据邮箱验证 code 激活账号。
 */
async function verifyEmail(req, res) {
  try {
    const valid = validateCode(req.body);
    if (!valid) {
      return sendValidationFailure(res, validateCode, req.body);
    }

    const result = await authService.verifyEmail(req.body.code);
    return sendServiceResult(res, result);
  } catch (error) {
    console.log(error);
    return res.status(500).json();
  }
}

async function checkEmail(req, res) {
  try {
    const result = await authService.checkEmail(req.params.email);
    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json();
  }
}

/**
 * 发送密码重置邮件。
 * 保留旧接口名称 `/send-preset-email`，避免影响前端和历史链接。
 */
async function sendResetPasswordEmail(req, res) {
  try {
    const valid = validateEmail(req.body);
    if (!valid) {
      return sendValidationFailure(res, validateEmail, req.body);
    }

    const result = await authService.sendResetPasswordEmail(req.body.email);
    return sendServiceResult(res, result);
  } catch (error) {
    console.log(error);
    return res.status(500).json();
  }
}

async function resetPassword(req, res) {
  try {
    const valid = validateResetPassword(req.body);
    if (!valid) {
      return sendValidationFailure(res, validateResetPassword, req.body);
    }

    const result = await authService.resetPassword(req.body);
    return sendServiceResult(res, result);
  } catch (error) {
    console.log(error);
    return res.status(500).json();
  }
}

async function checkResetCode(req, res) {
  try {
    const result = await authService.checkResetCode(req.params.code);
    return res.status(200).json(result);
  } catch (error) {
    console.log(error);
    return res.status(500).json();
  }
}

/**
 * 前端清理 token 的触发通道。
 * JWT 无状态，后端不维护 session 或 token 黑名单；仅向前端返回成功语义。
 */
async function logout(_req, res) {
  return res.status(200).json({ message: "登出成功" });
}

async function getCurrentUser(req, res) {
  try {
    if (!req.account || !req.account.id) {
      return res.status(401).json({ message: "未登录" });
    }

    const rows = await authService.getCurrentUser(req.account.id);
    if (rows.length === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error("/info route failed:", error);
    return res.status(500).json({ message: "服务器内部错误" });
  }
}

async function getCurrentUserEmailVerified(req, res) {
  try {
    const result = await authService.getCurrentUserEmailVerified(req.account.id);
    return res.status(200).json(result);
  } catch (error) {
    console.log(`/check/email route failed with error ${error}`);
    return res.status(500).json();
  }
}

module.exports = {
  checkEmail,
  checkResetCode,
  getCurrentUser,
  getCurrentUserEmailVerified,
  login,
  logout,
  resetPassword,
  sendEmailVerification,
  sendResetPasswordEmail,
  signup,
  verifyEmail
};
