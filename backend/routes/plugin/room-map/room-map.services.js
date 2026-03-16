const { query, getClient } = require('../../../database/postgreDB/pg');

/**
 * 查询插件房型映射列表。
 * @param {Object} params 查询参数
 * @param {string} params.platform 平台标识，可选
 * @returns {Promise<Array<Object>>} 映射列表（含本地房型名称）
 * @throws {Error} 数据库查询失败时抛出异常
 */
async function listPluginRoomTypeMappingsService({ platform }) {
  /**
   * 基础查询 SQL。
   * 联表 room_types 返回本地房型名称，前端可以直接展示名称。
   */
  let sql = `
    SELECT
      prm.id,
      prm.platform,
      prm.ota_room_type,
      prm.local_room_type,
      rt.type_name AS local_room_type_name,
      prm.created_at,
      prm.updated_at
    FROM plugin_room_type_mapping prm
    LEFT JOIN room_types rt
      ON rt.type_code = prm.local_room_type
  `;

  /**
   * SQL 参数列表。
   */
  const values = [];

  if (platform) {
    sql += ` WHERE prm.platform = $1`;
    values.push(platform);
  }

  sql += ` ORDER BY prm.platform ASC, prm.ota_room_type ASC, prm.id ASC`;

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
      WITH upserted AS (
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
        RETURNING
          id,
          platform,
          ota_room_type,
          local_room_type,
          created_at,
          updated_at
      )
      SELECT
        upserted.id,
        upserted.platform,
        upserted.ota_room_type,
        upserted.local_room_type,
        rt.type_name AS local_room_type_name,
        upserted.created_at,
        upserted.updated_at
      FROM upserted
      LEFT JOIN room_types rt
        ON rt.type_code = upserted.local_room_type
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
