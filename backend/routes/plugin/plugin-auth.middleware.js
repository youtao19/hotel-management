"use strict";

const crypto = require("crypto");

// 插件签名默认时间窗口（秒），用于限制请求时效性，降低重放风险。
const DEFAULT_SIGN_SKEW_SECONDS = 300;
// 插件 nonce 默认有效期（秒），用于防止同一请求重复提交。
const DEFAULT_NONCE_TTL_SECONDS = 600;
// 插件请求 nonce 最小长度。
const MIN_NONCE_LENGTH = 8;
// 插件请求 nonce 最大长度。
const MAX_NONCE_LENGTH = 128;
// 内存 nonce 缓存，键为 nonce，值为过期秒级时间戳。
const nonceCache = new Map();

/**
 * 统一返回插件鉴权错误响应。
 * @param {import('express').Response} res 响应对象
 * @param {number} statusCode HTTP 状态码
 * @param {string} code 业务错误码
 * @param {string} message 错误信息
 * @returns {import('express').Response} 响应对象
 */
function sendAuthError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    code,
    message
  });
}

/**
 * 读取并标准化正整数环境变量。
 * @param {string} envName 环境变量名
 * @param {number} fallbackValue 默认值
 * @returns {number} 正整数配置值
 */
function getPositiveIntegerEnv(envName, fallbackValue) {
  const rawValue = Number(process.env[envName]);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return fallbackValue;
  }
  return Math.floor(rawValue);
}

/**
 * 生成请求体 SHA256 摘要（hex）。
 * @param {string} rawBody 原始请求体
 * @returns {string} SHA256 摘要
 */
function buildBodyHash(rawBody) {
  return crypto
    .createHash("sha256")
    .update(String(rawBody || ""), "utf8")
    .digest("hex");
}

/**
 * 生成插件签名基串。
 * @param {string} method HTTP 方法
 * @param {string} path 请求路径（不含 query）
 * @param {string} timestamp 秒级或毫秒级时间戳字符串
 * @param {string} nonce 单次随机串
 * @param {string} rawBody 原始请求体
 * @returns {string} 签名基串
 */
function buildSignPayload(method, path, timestamp, nonce, rawBody) {
  // 按固定换行拼接字段，确保签名可重复计算。
  return [
    String(method || "").toUpperCase(),
    String(path || ""),
    String(timestamp || ""),
    String(nonce || ""),
    buildBodyHash(rawBody)
  ].join("\n");
}

/**
 * 计算插件请求签名。
 * @param {string} secret 插件签名密钥
 * @param {string} method HTTP 方法
 * @param {string} path 请求路径（不含 query）
 * @param {string} timestamp 秒级或毫秒级时间戳字符串
 * @param {string} nonce 单次随机串
 * @param {string} rawBody 原始请求体
 * @returns {string} HMAC-SHA256 签名（hex）
 */
function buildPluginSignature(secret, method, path, timestamp, nonce, rawBody) {
  const signPayload = buildSignPayload(method, path, timestamp, nonce, rawBody);
  return crypto
    .createHmac("sha256", String(secret || ""))
    .update(signPayload, "utf8")
    .digest("hex");
}

/**
 * 使用常量时间比较，降低时序攻击风险。
 * @param {string} left 左值
 * @param {string} right 右值
 * @returns {boolean} 是否相等
 */
function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * 将时间戳字符串转为秒级整数。
 * @param {string} timestamp 时间戳字符串（10位秒或13位毫秒）
 * @returns {number|null} 秒级时间戳；非法时返回 null
 */
function parseTimestampSeconds(timestamp) {
  if (!/^\d{10,13}$/.test(String(timestamp || ""))) {
    return null;
  }
  if (String(timestamp).length === 13) {
    return Math.floor(Number(timestamp) / 1000);
  }
  return Number(timestamp);
}

/**
 * 清理 nonce 缓存中已过期数据，避免内存无限增长。
 * @param {number} nowSeconds 当前秒级时间戳
 * @returns {void}
 */
function cleanupExpiredNonce(nowSeconds) {
  for (const [cachedNonce, expireAt] of nonceCache.entries()) {
    if (expireAt <= nowSeconds) {
      nonceCache.delete(cachedNonce);
    }
  }
}

/**
 * 记录并校验 nonce 是否重复。
 * @param {string} nonce 单次随机串
 * @param {number} nowSeconds 当前秒级时间戳
 * @param {number} ttlSeconds 过期秒数
 * @returns {boolean} true 表示首次出现；false 表示重复
 */
function consumeNonce(nonce, nowSeconds, ttlSeconds) {
  cleanupExpiredNonce(nowSeconds);
  if (nonceCache.has(nonce)) {
    return false;
  }
  nonceCache.set(nonce, nowSeconds + ttlSeconds);
  return true;
}

/**
 * 获取签名校验所需的路径（不包含 query）。
 * @param {import('express').Request} req 请求对象
 * @returns {string} 路径字符串
 */
function getRequestPath(req) {
  const originalUrl = String(req.originalUrl || req.url || "");
  return originalUrl.split("?")[0];
}

/**
 * 插件接口动态签名鉴权中间件。
 * @param {import('express').Request} req 请求对象
 * @param {import('express').Response} res 响应对象
 * @param {import('express').NextFunction} next next 回调
 * @returns {void}
 */
function pluginAuth(req, res, next) {
  // 插件调用方身份标识，需与服务端配置一致。
  const pluginApiKey = String(process.env.PLUGIN_API_KEY || "").trim();
  // 插件签名密钥，用于 HMAC-SHA256 计算。
  const pluginApiSecret = String(process.env.PLUGIN_API_SECRET || "").trim();
  // 请求可接受的最大时间偏差（秒）。
  const allowedSkewSeconds = getPositiveIntegerEnv("PLUGIN_SIGN_SKEW_SECONDS", DEFAULT_SIGN_SKEW_SECONDS);
  // nonce 缓存时长（秒）。
  const nonceTtlSeconds = getPositiveIntegerEnv("PLUGIN_NONCE_TTL_SECONDS", DEFAULT_NONCE_TTL_SECONDS);

  if (!pluginApiKey || !pluginApiSecret) {
    sendAuthError(res, 500, "PLUGIN_AUTH_NOT_CONFIGURED", "PLUGIN_API_KEY 或 PLUGIN_API_SECRET 未配置");
    return;
  }

  // 客户端标识头。
  const requestKey = String(req.get("x-plugin-key") || "").trim();
  // 请求时间戳头。
  const requestTimestamp = String(req.get("x-plugin-timestamp") || "").trim();
  // 防重放随机串头。
  const requestNonce = String(req.get("x-plugin-nonce") || "").trim();
  // HMAC 签名头。
  const requestSignature = String(req.get("x-plugin-signature") || "").trim().toLowerCase();

  if (!requestKey || !requestTimestamp || !requestNonce || !requestSignature) {
    sendAuthError(res, 401, "PLUGIN_AUTH_MISSING_HEADERS", "缺少签名鉴权请求头");
    return;
  }

  if (!timingSafeEqualText(requestKey, pluginApiKey)) {
    sendAuthError(res, 401, "PLUGIN_AUTH_INVALID_KEY", "插件 key 无效");
    return;
  }

  if (requestNonce.length < MIN_NONCE_LENGTH || requestNonce.length > MAX_NONCE_LENGTH) {
    sendAuthError(res, 401, "PLUGIN_AUTH_INVALID_NONCE", "nonce 长度不合法");
    return;
  }

  const requestTimestampSeconds = parseTimestampSeconds(requestTimestamp);
  if (!Number.isFinite(requestTimestampSeconds)) {
    sendAuthError(res, 401, "PLUGIN_AUTH_INVALID_TIMESTAMP", "时间戳格式错误");
    return;
  }

  // 当前秒级时间戳，用于校验时效窗口与 nonce 过期。
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - requestTimestampSeconds) > allowedSkewSeconds) {
    sendAuthError(res, 401, "PLUGIN_AUTH_TIMESTAMP_EXPIRED", "时间戳超出允许窗口");
    return;
  }

  // 参与签名的请求路径（不含 query）。
  const requestPath = getRequestPath(req);
  // 使用 app 中 captureRawBody 捕获到的原始请求体做签名，保证和调用方一致。
  const rawBody = String(req.rawBody || "");
  // 服务端重算期望签名。
  const expectedSignature = buildPluginSignature(
    pluginApiSecret,
    req.method,
    requestPath,
    requestTimestamp,
    requestNonce,
    rawBody
  );

  if (!timingSafeEqualText(requestSignature, expectedSignature)) {
    sendAuthError(res, 401, "PLUGIN_AUTH_INVALID_SIGNATURE", "签名校验失败");
    return;
  }

  if (!consumeNonce(requestNonce, nowSeconds, nonceTtlSeconds)) {
    sendAuthError(res, 401, "PLUGIN_AUTH_NONCE_REPLAYED", "nonce 已被使用");
    return;
  }

  // 仅透传必要鉴权上下文，避免在后续链路传递明文密钥。
  req.pluginAuth = {
    key: requestKey,
    timestamp: requestTimestamp,
    nonce: requestNonce,
    path: requestPath
  };

  next();
}

module.exports = {
  pluginAuth,
  buildPluginSignature,
  buildSignPayload
};
