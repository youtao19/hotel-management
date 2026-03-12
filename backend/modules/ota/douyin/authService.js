"use strict";

const crypto = require('crypto');
const { query } = require('../../../database/postgreDB/pg');
const { createDouyinError } = require('./error');

/**
 * 获取已启用的抖音账号配置。
 * @returns {Promise<object>} 抖音账号配置
 * @throws {Error} 未配置时抛出异常
 */
async function getEnabledAccountConfig() {
  const result = await query(
    `SELECT *
       FROM douyin_account_config
      WHERE enabled = TRUE
      ORDER BY updated_at DESC
      LIMIT 1`
  );

  if (!result.rows.length) {
    throw createDouyinError('未找到启用中的抖音账号配置', 'DOUYIN_ACCOUNT_NOT_CONFIGURED', 503);
  }

  return result.rows[0];
}

/**
 * 计算抖音请求签名。
 * @param {string} secret 入站密钥
 * @param {string} timestamp 时间戳
 * @param {string} rawBody 原始请求体
 * @returns {string} HMAC-SHA256 签名
 */
function buildInboundSignature(secret, timestamp, rawBody) {
  return crypto
    .createHmac('sha256', String(secret || ''))
    .update(`${String(timestamp || '')}\n${String(rawBody || '')}`, 'utf8')
    .digest('hex');
}

/**
 * 校验抖音入站请求签名。
 * @param {import('express').Request} req 请求对象
 * @returns {Promise<object>} 已验证的账号配置
 * @throws {Error} 签名校验失败时抛出异常
 */
async function verifyInboundRequest(req) {
  const config = await getEnabledAccountConfig();
  const clientKey = String(req.get('x-douyin-client-key') || '').trim();
  const timestamp = String(req.get('x-douyin-timestamp') || '').trim();
  const signature = String(req.get('x-douyin-signature') || '').trim().toLowerCase();

  if (!clientKey || clientKey !== String(config.client_key || '').trim()) {
    throw createDouyinError('抖音 client key 无效', 'DOUYIN_AUTH_INVALID_CLIENT_KEY', 401);
  }
  if (!/^\d{10,13}$/.test(timestamp)) {
    throw createDouyinError('抖音时间戳格式错误', 'DOUYIN_AUTH_INVALID_TIMESTAMP', 401);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const tsSeconds = timestamp.length === 13 ? Math.floor(Number(timestamp) / 1000) : Number(timestamp);
  if (!Number.isFinite(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > 300) {
    throw createDouyinError('抖音时间戳超出允许窗口', 'DOUYIN_AUTH_TIMESTAMP_EXPIRED', 401);
  }

  const expectedSignature = buildInboundSignature(config.inbound_secret, timestamp, req.rawBody || '');
  if (signature !== expectedSignature) {
    throw createDouyinError('抖音签名校验失败', 'DOUYIN_AUTH_INVALID_SIGNATURE', 401);
  }

  return config;
}

module.exports = {
  buildInboundSignature,
  getEnabledAccountConfig,
  verifyInboundRequest
};
