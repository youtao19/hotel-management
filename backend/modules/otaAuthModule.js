"use strict";

const crypto = require('crypto');
const setup = require('../appSettings/setup');
const redisDb = require('../database/redis/redis');

// OTA 鉴权错误统一挂上业务状态码，便于路由层直接透传。
function createAuthError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function getChannelConfig(channelCode) {
  const normalizedChannelCode = String(channelCode || '').trim().toLowerCase();
  const channelConfig = setup.ota?.channels?.[normalizedChannelCode];

  if (!setup.ota?.enabled) {
    throw createAuthError(403, 'OTA_API_DISABLED', 'OTA API 未启用');
  }
  if (!normalizedChannelCode || !channelConfig) {
    throw createAuthError(403, 'OTA_CHANNEL_UNSUPPORTED', '不支持的 OTA 渠道');
  }
  if (!channelConfig.key || !channelConfig.secret) {
    throw createAuthError(403, 'OTA_CHANNEL_MISCONFIGURED', 'OTA 渠道配置不完整');
  }

  return {
    channelCode: normalizedChannelCode,
    key: String(channelConfig.key),
    secret: String(channelConfig.secret)
  };
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function buildSignatureBase({ method, path, timestamp, nonce, rawBody }) {
  const bodyHash = sha256Hex(rawBody || '');
  return [
    String(method || '').toUpperCase(),
    String(path || ''),
    String(timestamp || ''),
    String(nonce || ''),
    bodyHash
  ].join('\n');
}

function signPayload(secret, payload) {
  return crypto.createHmac('sha256', String(secret || '')).update(payload, 'utf8').digest('hex');
}

function normalizeTimestamp(rawTimestamp) {
  const text = String(rawTimestamp || '').trim();
  if (!/^\d{10,13}$/.test(text)) {
    throw createAuthError(401, 'OTA_TIMESTAMP_INVALID', '请求时间戳格式错误');
  }

  const numericValue = Number(text);
  if (!Number.isFinite(numericValue)) {
    throw createAuthError(401, 'OTA_TIMESTAMP_INVALID', '请求时间戳格式错误');
  }

  // 兼容秒和毫秒时间戳，统一转换成秒。
  return text.length === 13 ? Math.floor(numericValue / 1000) : numericValue;
}

function assertTimestampWithinWindow(timestampSeconds) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const diff = Math.abs(nowSeconds - timestampSeconds);
  if (diff > Number(setup.ota?.signSkewSeconds || 300)) {
    throw createAuthError(401, 'OTA_TIMESTAMP_EXPIRED', '请求时间戳超出允许窗口');
  }
}

function timingSafeEqualHex(left, right) {
  const leftText = String(left || '');
  const rightText = String(right || '');
  if (leftText.length !== rightText.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(leftText, 'utf8'),
    Buffer.from(rightText, 'utf8')
  );
}

async function consumeNonce(channelCode, nonce) {
  const normalizedNonce = String(nonce || '').trim();
  if (!normalizedNonce) {
    throw createAuthError(401, 'OTA_NONCE_MISSING', '缺少防重放 nonce');
  }

  const redisClient = redisDb.getClient() || await redisDb.initialize();
  // Redis SET NX EX 用于防止同一个 nonce 在时间窗内被重复消费。
  const replayKey = `ota:nonce:${channelCode}:${normalizedNonce}`;
  const result = await redisClient.set(
    replayKey,
    '1',
    {
      NX: true,
      EX: Number(setup.ota?.nonceTtlSeconds || 600)
    }
  );

  if (result !== 'OK') {
    throw createAuthError(401, 'OTA_NONCE_REPLAYED', '重复请求已被拒绝');
  }
}

async function verifyOtaRequest(req) {
  const channelHeader = req.get('x-ota-channel');
  const keyHeader = req.get('x-ota-key');
  const timestampHeader = req.get('x-ota-timestamp');
  const nonceHeader = req.get('x-ota-nonce');
  const signatureHeader = req.get('x-ota-signature');

  const channelConfig = getChannelConfig(channelHeader);
  if (String(keyHeader || '').trim() !== channelConfig.key) {
    throw createAuthError(401, 'OTA_KEY_INVALID', 'OTA 访问凭证无效');
  }

  const timestampSeconds = normalizeTimestamp(timestampHeader);
  assertTimestampWithinWindow(timestampSeconds);

  const signatureBase = buildSignatureBase({
    method: req.method,
    path: `${req.baseUrl || ''}${req.path || ''}`,
    timestamp: String(timestampHeader || ''),
    nonce: String(nonceHeader || ''),
    rawBody: req.rawBody || ''
  });
  const expectedSignature = signPayload(channelConfig.secret, signatureBase);

  if (!timingSafeEqualHex(signatureHeader, expectedSignature)) {
    throw createAuthError(401, 'OTA_SIGNATURE_INVALID', 'OTA 请求签名校验失败');
  }

  await consumeNonce(channelConfig.channelCode, nonceHeader);

  return {
    channelCode: channelConfig.channelCode,
    key: channelConfig.key,
    timestamp: String(timestampHeader || ''),
    nonce: String(nonceHeader || '')
  };
}

function createOtaAuthMiddleware() {
  return async (req, res, next) => {
    try {
      req.ota = await verifyOtaRequest(req);
      next();
    } catch (error) {
      const statusCode = error.statusCode || 401;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'OTA 鉴权失败',
        error: {
          code: error.code || 'OTA_AUTH_ERROR'
        }
      });
    }
  };
}

module.exports = {
  buildSignatureBase,
  createAuthError,
  createOtaAuthMiddleware,
  signPayload,
  verifyOtaRequest
};
