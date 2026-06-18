"use strict";

const { verifyAccountToken } = require("./jwt.helper");

/**
 * 从请求头读取并校验 Bearer token。
 * 不直接返回 401，方便公开路由共用且不强制鉴权。
 * 解析失败时返回具体原因，便于中间件回 401。
 * @param {import('express').Request} req 请求对象
 * @returns {{ok:true,account:object}|{ok:false,reason:string}}
 */
function resolveAccountFromRequest(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization) {
    return { ok: false, reason: "missing" };
  }

  if (!authorization.startsWith("Bearer ")) {
    return { ok: false, reason: "format" };
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, reason: "empty" };
  }

  try {
    return { ok: true, account: verifyAccountToken(token) };
  } catch (error) {
    // 过期和签名/格式错误都视为未授权，不对外区分细节。
    return { ok: false, reason: "invalid" };
  }
}

/**
 * 解析当前请求的登录账号。
 * 登录态中间件对所有请求运行：解析成功时写入 req.account，
 * 解析失败时不拦截，由具体路由用 ensureAuthenticated 守卫。
 */
function authenticationMiddleware(req, _res, next) {
  const result = resolveAccountFromRequest(req);
  if (result.ok) {
    req.account = result.account;
  }
  next();
}

/**
 * 受保护后台业务 API 的统一守卫。
 * 测试和真实环境使用同一套 JWT 判断逻辑；集成测试通过 tools.js 的 authHeader() 注入 token。
 */
function ensureAuthenticated(req, res, next) {
  if (req.account && req.account.id) {
    return next();
  }

  return res.status(401).json({ message: "未登录" });
}

module.exports = {
  authenticationMiddleware,
  ensureAuthenticated,
  resolveAccountFromRequest
};
