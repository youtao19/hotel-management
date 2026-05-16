"use strict";

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

function parseJsonObject(value, fieldName) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    const error = new Error(`${fieldName} 必须是 JSON 对象`);
    error.statusCode = 400;
    throw error;
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not object');
    }
    return parsed;
  } catch (_error) {
    const error = new Error(`${fieldName} 不是合法 JSON`);
    error.statusCode = 400;
    throw error;
  }
}

function parseWebhookPayload(body) {
  const outer = parseJsonObject(body, 'Webhook 请求体');
  // 抖音 Webhook 的 content 有时是 JSON 字符串，有时已被框架解析成对象，入口处统一成对象。
  const content = typeof outer.content === 'string'
    ? parseJsonObject(outer.content, 'Webhook content')
    : (outer.content || {});

  return {
    event: outer.event || '',
    clientKey: outer.client_key || '',
    logId: outer.log_id || '',
    content
  };
}

async function markMessageProcessed(redisClient, msgId) {
  if (!msgId) {
    // 没有消息 ID 时无法做幂等判断，只能继续处理并依赖后续业务校验兜底。
    return { duplicate: false };
  }

  const key = `douyin:webhook:msg:${msgId}`;
  // 使用 Redis NX 保证同一个 msgId 只有第一次进入业务处理，TTL 避免幂等键长期堆积。
  const result = await redisClient.set(key, '1', {
    NX: true,
    EX: IDEMPOTENCY_TTL_SECONDS
  });

  return {
    duplicate: result !== 'OK'
  };
}

function buildWebhookLog(payload, headers = {}) {
  return {
    event: payload.event,
    msgId: headers.msgId || '',
    logId: payload.logId || headers.logId || '',
    clientKey: payload.clientKey,
    content: payload.content
  };
}

module.exports = {
  IDEMPOTENCY_TTL_SECONDS,
  parseWebhookPayload,
  markMessageProcessed,
  buildWebhookLog
};
