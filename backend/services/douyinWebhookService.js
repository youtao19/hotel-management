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
    return { duplicate: false };
  }

  const key = `douyin:webhook:msg:${msgId}`;
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
