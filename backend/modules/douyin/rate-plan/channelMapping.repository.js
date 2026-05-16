"use strict";

const postgreDB = require('../../../database/postgreDB/pg')

/**
 * 保存本地资源与渠道资源的映射关系。
 *
 * 这里统一用 UPSERT，是为了让“首次同步”和“再次更新”共用同一条链路，
 * 避免运营重复点击同步按钮时写出多条渠道映射。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.localTargetType 本地资源类型。
 * @param {number} params.localTargetId 本地资源 ID。
 * @param {string} params.channelCode 渠道编码。
 * @param {string} params.channelItemId 渠道侧资源 ID。
 * @param {Object} [params.channelConfig] 渠道专属配置。
 * @param {number} [params.syncStatus] 同步状态。
 * @param {Object} [params.client] 可选事务客户端。
 * @returns {Promise<Object>} 映射记录。
 */
async function upsertChannelMapping({
  localTargetType,
  localTargetId,
  channelCode,
  channelItemId,
  channelConfig = {},
  syncStatus = 1,
  client,
}) {
  const queryRunner = client || postgreDB
  const sql = `
    INSERT INTO ota_channel_mappings (
      local_target_type,
      local_target_id,
      channel_code,
      channel_item_id,
      channel_config,
      sync_status
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    ON CONFLICT (local_target_type, local_target_id, channel_code)
    DO UPDATE SET
      channel_item_id = EXCLUDED.channel_item_id,
      channel_config = EXCLUDED.channel_config,
      sync_status = EXCLUDED.sync_status,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `

  const result = await queryRunner.query(sql, [
    localTargetType,
    localTargetId,
    channelCode,
    channelItemId,
    JSON.stringify(channelConfig || {}),
    syncStatus,
  ])

  return result.rows[0]
}

async function upsertRatePlanMapping({
  localRatePlanId,
  douyinRatePlanId,
  channelConfig = {},
  syncStatus = 1,
  client,
}) {
  return upsertChannelMapping({
    localTargetType: 'RATE_PLAN',
    localTargetId: localRatePlanId,
    channelCode: 'DOUYIN',
    channelItemId: douyinRatePlanId,
    channelConfig,
    syncStatus,
    client,
  });
}

module.exports = {
  upsertChannelMapping,
  upsertRatePlanMapping,
}
