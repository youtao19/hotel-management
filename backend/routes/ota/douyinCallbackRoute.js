"use strict";

const crypto = require('crypto');
const express = require('express');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { verifyInboundRequest } = require('../../modules/ota/douyin/authService');
const { createDouyinError, sendDouyinError } = require('../../modules/ota/douyin/error');
const { createDouyinOrder, cancelDouyinOrder } = require('../../modules/ota/douyin/orderService');
const { getAccountConfig } = require('../../modules/ota/douyin/configService');

const router = express.Router();
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// 抖音金额字段允许：正数数值，或最多两位小数的金额字符串。
const amountSchema = {
  anyOf: [
    { type: 'number', exclusiveMinimum: 0 },
    { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d{1,2})?$' }
  ]
};

// 抖音创单请求参数校验规则。
const createOrderSchema = {
  type: 'object',
  properties: {
    douyin_order_id: { type: 'string', minLength: 1 },
    order_out_id: { type: 'string' },
    guest_name: { type: 'string', minLength: 1 },
    phone: { type: 'string' },
    room_id: { type: 'string', minLength: 1 },
    rate_plan_id: { type: 'string' },
    check_in_date: { type: 'string', format: 'date' },
    check_out_date: { type: 'string', format: 'date' },
    total_price: amountSchema,
    daily_prices: {
      type: 'object',
      minProperties: 1,
      propertyNames: { type: 'string', format: 'date' },
      additionalProperties: amountSchema
    },
    pay_status: { type: 'string' },
    payment_method: { type: 'string' },
    remarks: { type: 'string' }
  },
  required: ['douyin_order_id', 'guest_name', 'room_id', 'check_in_date', 'check_out_date'],
  anyOf: [
    { required: ['total_price'] },
    { required: ['daily_prices'] }
  ],
  additionalProperties: true
};

// 抖音取消订单请求参数校验规则。
const cancelOrderSchema = {
  type: 'object',
  properties: {
    douyin_order_id: { type: 'string' },
    order_out_id: { type: 'string' },
    cancel_reason: { type: 'string' }
  },
  anyOf: [
    { required: ['douyin_order_id'] },
    { required: ['order_out_id'] }
  ],
  additionalProperties: true
};

// 预编译 AJV 校验器，避免每次请求重复编译规则。
const validateCreateOrder = ajv.compile(createOrderSchema);
const validateCancelOrder = ajv.compile(cancelOrderSchema);

/**
 * 校验抖音入站签名。
 * 参数说明：读取请求头 client key、timestamp、signature，并使用原始请求体验签。
 * 返回值说明：校验通过后挂载 douyinAccount 到请求对象，并进入后续中间件。
 * 异常说明：验签失败时输出统一错误响应，不向下游继续传递。
 * @param {import('express').Request} req 请求对象
 * @param {import('express').Response} res 响应对象
 * @param {import('express').NextFunction} next Express 下一个中间件
 * @returns {Promise<void>}
 */
async function douyinInboundAuth(req, res, next) {
  try {
    req.douyinAccount = await verifyInboundRequest(req);
    next();
  } catch (error) {
    sendDouyinError(res, error, '抖音请求鉴权失败');
  }
}

/**
 * 计算抖音 Webhook 签名。
 * 参数说明：按抖音约定使用 appSecret + rawBody 进行 SHA1 计算。
 * 返回值说明：返回 40 位十六进制小写签名。
 * 异常说明：无显式异常，空值按空字符串参与计算。
 * @param {string} appSecret 抖音应用密钥
 * @param {string} rawBody 原始请求体
 * @returns {string} 计算后的签名
 */
function buildWebhookSignature(appSecret, rawBody) {
  return crypto
    .createHash('sha1')
    .update(`${String(appSecret || '')}${String(rawBody || '')}`, 'utf8')
    .digest('hex');
}

/**
 * 安全比较两个签名值，避免时序攻击。
 * 参数说明：仅在双方非空且长度一致时执行恒时比较。
 * 返回值说明：签名一致返回 true，否则返回 false。
 * 异常说明：无显式异常，异常分支统一返回 false。
 * @param {string} leftValue 左侧签名
 * @param {string} rightValue 右侧签名
 * @returns {boolean} 是否匹配
 */
function safeCompareSignature(leftValue, rightValue) {
  const normalizedLeft = String(leftValue || '').trim().toLowerCase();
  const normalizedRight = String(rightValue || '').trim().toLowerCase();
  if (!normalizedLeft || !normalizedRight || normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  const leftBuffer = Buffer.from(normalizedLeft, 'utf8');
  const rightBuffer = Buffer.from(normalizedRight, 'utf8');
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * 读取并标准化抖音 Webhook 请求体。
 * 参数说明：兼容 application/json 与 text/plain(JSON 字符串) 两种格式。
 * 返回值说明：返回对象类型请求体；无法解析时返回空对象。
 * 异常说明：解析失败时吞掉异常并回退为空对象，由上层按缺参处理。
 * @param {import('express').Request} req 请求对象
 * @returns {object} 标准化后的请求体
 */
function getWebhookPayload(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body;
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      const parsedPayload = JSON.parse(req.body);
      if (parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)) {
        return parsedPayload;
      }
    } catch (_error) {
      return {};
    }
  }

  return {};
}

/**
 * 抖音 Webhook 回调接口（verify_webhook 验证与事件接收）。
 * 参数说明：请求体为抖音事件 JSON；verify_webhook 需要 challenge 参数。
 * 返回值说明：verify_webhook 按文档返回 text/plain JSON 文本；其他事件返回统一 success 响应。
 * 异常说明：challenge 缺失或签名校验失败时返回业务错误响应。
 */
router.post('/webhook', async (req, res) => {
  try {
    const accountConfig = await getAccountConfig();
    const payload = getWebhookPayload(req);
    const eventName = String(payload.event || '').trim();
    const rawChallenge = payload?.content?.challenge ?? payload?.challenge ?? req.query?.challenge;
    const challenge = Array.isArray(rawChallenge) ? rawChallenge[0] : rawChallenge;
    const webhookSignature = String(req.get('x-douyin-signature') || '').trim();
    const appSecret = String(accountConfig?.app_secret || '').trim();

    // URL 验证时支持 event=verify_webhook，或仅携带 challenge 的场景。
    const isVerifyWebhookEvent = eventName === 'verify_webhook' || challenge !== undefined;
    if (isVerifyWebhookEvent) {
      if (challenge === undefined || challenge === null || String(challenge).trim() === '') {
        throw createDouyinError('verify_webhook 缺少 challenge 参数', 'DOUYIN_WEBHOOK_CHALLENGE_REQUIRED', 400);
      }

      // 验证回调允许无签名；若平台带签名则按 appSecret 做严格校验。
      if (webhookSignature && appSecret) {
        const expectedSignature = buildWebhookSignature(appSecret, req.rawBody || '');
        if (!safeCompareSignature(webhookSignature, expectedSignature)) {
          throw createDouyinError('抖音 Webhook 签名校验失败', 'DOUYIN_WEBHOOK_INVALID_SIGNATURE', 401);
        }
      }

      // 按官方文档要求：以 text 格式返回 JSON 文本。
      const verifyResponseBody = JSON.stringify({
        // challenge 按平台下发的原始类型原样返回，避免类型差异导致校验失败。
        challenge
      });
      return res.status(200).type('text/plain; charset=utf-8').send(verifyResponseBody);
    }

    if (!webhookSignature || !appSecret) {
      throw createDouyinError(
        '缺少 Webhook 签名或 appSecret 配置，无法校验事件来源',
        'DOUYIN_WEBHOOK_SIGNATURE_REQUIRED',
        401
      );
    }

    const expectedSignature = buildWebhookSignature(appSecret, req.rawBody || '');
    if (!safeCompareSignature(webhookSignature, expectedSignature)) {
      throw createDouyinError('抖音 Webhook 签名校验失败', 'DOUYIN_WEBHOOK_INVALID_SIGNATURE', 401);
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook 事件接收成功'
    });
  } catch (error) {
    return sendDouyinError(res, error, '抖音 Webhook 处理失败');
  }
});

/**
 * 抖音创单回调接口。
 * 参数说明：请求体需满足 createOrderSchema。
 * 返回值说明：创建成功返回 201，重复订单返回 200，均包含 success 与 data 字段。
 * 异常说明：参数不合法返回 400，业务异常统一由 sendDouyinError 输出。
 */
router.post('/order/create', douyinInboundAuth, async (req, res) => {
  if (!validateCreateOrder(req.body)) {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: validateCreateOrder.errors
    });
  }

  try {
    const result = await createDouyinOrder(req.body);
    return res.status(result.existing ? 200 : 201).json({
      success: true,
      existing: result.existing,
      data: result.data
    });
  } catch (error) {
    return sendDouyinError(res, error, '抖音创单失败');
  }
});

/**
 * 抖音取消订单回调接口。
 * 参数说明：请求体需满足 cancelOrderSchema。
 * 返回值说明：成功返回 200，返回取消结果和订单数据。
 * 异常说明：参数不合法返回 400，业务异常统一由 sendDouyinError 输出。
 */
router.post('/order/cancel', douyinInboundAuth, async (req, res) => {
  if (!validateCancelOrder(req.body)) {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: validateCancelOrder.errors
    });
  }

  try {
    const result = await cancelDouyinOrder(req.body);
    return res.status(200).json({
      success: true,
      data: result.data,
      cancelled: result.cancelled,
      alreadyCancelled: result.alreadyCancelled
    });
  } catch (error) {
    return sendDouyinError(res, error, '抖音取消订单失败');
  }
});

module.exports = router;
