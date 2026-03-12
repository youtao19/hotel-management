"use strict";

const { query } = require('../../../database/postgreDB/pg');
const { createDouyinError } = require('./error');

/**
 * 获取当前抖音账号配置。
 * @returns {Promise<object|null>} 账号配置
 */
async function getAccountConfig() {
  const result = await query(
    `SELECT *
       FROM douyin_account_config
      ORDER BY updated_at DESC
      LIMIT 1`
  );
  return result.rows[0] || null;
}

/**
 * 保存抖音账号配置。
 * @param {object} payload 配置参数
 * @returns {Promise<object>} 最新配置
 * @throws {Error} 参数不完整时抛出异常
 */
async function upsertAccountConfig(payload) {
  const accountCode = String(payload.accountCode || payload.account_code || 'default').trim() || 'default';
  const clientKey = String(payload.clientKey || payload.client_key || '').trim();
  const inboundSecret = String(payload.inboundSecret || payload.inbound_secret || '').trim();
  const accountId = String(payload.accountId || payload.account_id || '').trim() || null;
  const hotelId = String(payload.hotelId || payload.hotel_id || '').trim() || null;

  if (!clientKey) {
    throw createDouyinError('clientKey 不能为空', 'DOUYIN_ACCOUNT_CLIENT_KEY_REQUIRED');
  }
  if (!inboundSecret) {
    throw createDouyinError('inboundSecret 不能为空', 'DOUYIN_ACCOUNT_INBOUND_SECRET_REQUIRED');
  }

  const mockMode = String(payload.mockMode || payload.mock_mode || 'none').trim() || 'none';
  const allowedMockModes = new Set(['none', 'success', 'fail']);
  if (!allowedMockModes.has(mockMode)) {
    throw createDouyinError('mockMode 不合法', 'DOUYIN_ACCOUNT_MOCK_MODE_INVALID');
  }

  const result = await query(
    `INSERT INTO douyin_account_config (
       account_code, client_key, inbound_secret, app_id, app_secret, account_id,
       hotel_id, api_base_url, access_token, token_expire_at, enabled, mock_mode, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11, $12, now())
     ON CONFLICT (account_code)
     DO UPDATE SET
       client_key = EXCLUDED.client_key,
       inbound_secret = EXCLUDED.inbound_secret,
       app_id = EXCLUDED.app_id,
       app_secret = EXCLUDED.app_secret,
       account_id = EXCLUDED.account_id,
       hotel_id = EXCLUDED.hotel_id,
       api_base_url = EXCLUDED.api_base_url,
       access_token = EXCLUDED.access_token,
       token_expire_at = EXCLUDED.token_expire_at,
       enabled = EXCLUDED.enabled,
       mock_mode = EXCLUDED.mock_mode,
       updated_at = now()
     RETURNING *`,
    [
      accountCode,
      clientKey,
      inboundSecret,
      payload.appId || payload.app_id || null,
      payload.appSecret || payload.app_secret || null,
      accountId,
      hotelId,
      payload.apiBaseUrl || payload.api_base_url || null,
      payload.accessToken || payload.access_token || null,
      payload.tokenExpireAt || payload.token_expire_at || null,
      payload.enabled === undefined ? true : Boolean(payload.enabled),
      mockMode
    ]
  );

  return result.rows[0];
}

/**
 * 获取房型映射列表。
 * @returns {Promise<object[]>} 房型映射列表
 */
async function listRoomMappings() {
  const result = await query(
    `SELECT *
       FROM douyin_room_mapping
      ORDER BY local_room_type, douyin_room_id, douyin_rate_plan_id`
  );
  return result.rows;
}

/**
 * 保存抖音房型映射。
 * @param {object} payload 映射参数
 * @returns {Promise<object>} 最新映射
 * @throws {Error} 房型不存在时抛出异常
 */
async function upsertRoomMapping(payload) {
  const localRoomType = String(payload.localRoomType || payload.local_room_type || '').trim();
  const douyinRoomId = String(payload.douyinRoomId || payload.douyin_room_id || '').trim();
  const douyinRatePlanId = String(payload.douyinRatePlanId || payload.douyin_rate_plan_id || '').trim();

  if (!localRoomType) {
    throw createDouyinError('localRoomType 不能为空', 'DOUYIN_MAPPING_LOCAL_ROOM_TYPE_REQUIRED');
  }
  if (!douyinRoomId) {
    throw createDouyinError('douyinRoomId 不能为空', 'DOUYIN_MAPPING_ROOM_ID_REQUIRED');
  }

  const roomTypeResult = await query(
    `SELECT 1 FROM room_types WHERE type_code = $1`,
    [localRoomType]
  );
  if (!roomTypeResult.rows.length) {
    throw createDouyinError(`房型 ${localRoomType} 不存在`, 'DOUYIN_MAPPING_ROOM_TYPE_NOT_FOUND', 404);
  }

  const result = await query(
    `INSERT INTO douyin_room_mapping (
       local_room_type, douyin_room_id, douyin_rate_plan_id, sync_inventory,
       sync_price, enabled, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (douyin_room_id, douyin_rate_plan_id)
     DO UPDATE SET
       local_room_type = EXCLUDED.local_room_type,
       sync_inventory = EXCLUDED.sync_inventory,
       sync_price = EXCLUDED.sync_price,
       enabled = EXCLUDED.enabled,
       updated_at = now()
     RETURNING *`,
    [
      localRoomType,
      douyinRoomId,
      douyinRatePlanId,
      payload.syncInventory === undefined ? true : Boolean(payload.syncInventory),
      payload.syncPrice === undefined ? true : Boolean(payload.syncPrice),
      payload.enabled === undefined ? true : Boolean(payload.enabled)
    ]
  );

  return result.rows[0];
}

module.exports = {
  getAccountConfig,
  listRoomMappings,
  upsertAccountConfig,
  upsertRoomMapping
};
