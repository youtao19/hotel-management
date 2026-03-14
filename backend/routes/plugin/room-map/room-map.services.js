const { query, getClient } = require('../../../database/postgreDB/pg');

async function listPluginRoomTypeMappingsService({ platform }) {
  /**
   * 基础查询 SQL。
   * 按平台、OTA 房型、主键升序返回，保证结果稳定。
   */
  let sql = `
    SELECT
      id,
      platform,
      ota_room_type,
      local_room_type,
      created_at,
      updated_at
    FROM plugin_room_type_mapping
  `;

  /**
   * SQL 参数列表。
   */
  const values = [];

  if (platform) {
    sql += ` WHERE platform = $1`;
    values.push(platform);
  }

  sql += ` ORDER BY platform ASC, ota_room_type ASC, id ASC`;

  const result = await query(sql, values);
  return result.rows;
}

/**
 * 批量保存插件房型映射。
 * 已存在的映射执行更新，不存在的映射执行新增。
 * @param {Object} params 保存参数
 * @param {string} params.platform 插件平台标识
 * @param {Array<{otaRoomType: string, localRoomType: string}>} params.mappingList 映射数据列表
 * @returns {Promise<Object>} 保存结果
 * @throws {Error} 数据库写入失败时抛出异常
 */
async function createPluginRoomTypeMappingService({ platform, mappingList }) {
  let client = null;

  try {
    client = await getClient();
    await client.query('BEGIN');

    /**
     * 当平台和 OTA 房型已存在时，仅更新本地房型和更新时间。
     */
    const upsertSql = `
      INSERT INTO plugin_room_type_mapping (
        platform,
        ota_room_type,
        local_room_type
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (platform, ota_room_type)
      DO UPDATE SET
        local_room_type = EXCLUDED.local_room_type,
        updated_at = now()
      RETURNING id, platform, ota_room_type, local_room_type, created_at, updated_at
    `;

    // 保存后的映射结果
    const savedMappings = [];

    for (const item of mappingList) {
      const result = await client.query(upsertSql, [
        platform,
        item.otaRoomType,
        item.localRoomType
      ]);
      savedMappings.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return {
      success: true,
      code: "PLUGIN_ROOM_TYPE_MAPPING_SAVED",
      data: savedMappings,
      message: '插件房型映射保存成功'
    };
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}
async function updatePluginRoomTypeMappingService() { }

module.exports = {
  listPluginRoomTypeMappingsService,
  createPluginRoomTypeMappingService,
  updatePluginRoomTypeMappingService
};
