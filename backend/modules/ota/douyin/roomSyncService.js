"use strict";

const crypto = require('crypto');
const { getClient, query } = require('../../../database/postgreDB/pg');
const { formatDate, toAmountNumber } = require('../../tools');
const { createDouyinError } = require('./error');
const { getEnabledAccountConfig } = require('./authService');
const { sendSyncRequest } = require('./client');

const ACTIVE_ORDER_STATUSES = ['pending', 'reserved', 'checked-in', 'occupied'];
const OPEN_OUTBOX_STATUSES = ['pending', 'retrying', 'processing'];

/**
 * 将日期范围展开为字符串列表。
 * @param {string} startDate 开始日期
 * @param {string} endDate 结束日期
 * @param {object} client 数据库连接
 * @returns {Promise<string[]>} 日期列表
 * @throws {Error} 日期范围无效时抛出异常
 */
async function buildDateRange(startDate, endDate, client) {
  const normalizedStartDate = formatDate(startDate);
  const normalizedEndDate = formatDate(endDate);
  if (!normalizedStartDate || !normalizedEndDate) {
    throw createDouyinError('开始日期和结束日期不能为空', 'DOUYIN_SYNC_DATE_REQUIRED');
  }
  if (normalizedEndDate < normalizedStartDate) {
    throw createDouyinError('结束日期不能早于开始日期', 'DOUYIN_SYNC_DATE_RANGE_INVALID');
  }

  const result = await client.query(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS stay_date
       FROM generate_series($1::date, $2::date, INTERVAL '1 day') d`,
    [normalizedStartDate, normalizedEndDate]
  );
  return result.rows.map((row) => row.stay_date);
}

/**
 * 查询需要同步的房型映射。
 * @param {string|null} roomType 房型编码
 * @param {object} client 数据库连接
 * @returns {Promise<object[]>} 房型映射集合
 * @throws {Error} 未找到映射时抛出异常
 */
async function getSyncMappings(roomType, client) {
  const result = await client.query(
    `SELECT m.*, rt.base_price, rt.type_name
       FROM douyin_room_mapping m
       JOIN room_types rt ON rt.type_code = m.local_room_type
      WHERE m.enabled = TRUE
        AND ($1::text IS NULL OR m.local_room_type = $1)
      ORDER BY m.local_room_type`,
    [roomType]
  );

  if (!result.rows.length) {
    throw createDouyinError('没有可同步的抖音房型映射', 'DOUYIN_SYNC_MAPPING_NOT_FOUND', 404);
  }
  return result.rows;
}

/**
 * 为同步请求生成稳定哈希，避免重复创建同一批任务。
 * @param {object} payload 同步请求体
 * @returns {string} SHA1 摘要前 16 位
 * @throws {Error} 无
 */
function buildPayloadHash(payload) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(payload || {}), 'utf8')
    .digest('hex')
    .slice(0, 16);
}

/**
 * 组装售卖房型同步中的可选字段。
 * @param {object} payload 任务请求参数
 * @returns {object} 可选字段对象
 * @throws {Error} 无
 */
function buildRatePlanOptionalFields(payload) {
  const optionalFields = {};

  if (payload.active !== undefined) optionalFields.active = Boolean(payload.active);
  if (payload.confirmImmediately !== undefined) optionalFields.confirm_immediately = Boolean(payload.confirmImmediately);
  if (payload.policy !== undefined) optionalFields.policy = Number(payload.policy);
  if (payload.settleType !== undefined) optionalFields.settle_type = Number(payload.settleType);
  if (payload.salesTag !== undefined) optionalFields.sales_tag = Number(payload.salesTag);
  if (payload.salesType !== undefined) optionalFields.sales_type = Number(payload.salesType);

  if (payload.currency !== undefined) {
    optionalFields.currency = String(payload.currency || '').trim().toUpperCase();
  }
  if (Array.isArray(payload.crowdConfig)) {
    optionalFields.crowd_config = payload.crowdConfig.map((item) => Number(item));
  }

  return optionalFields;
}

/**
 * 组装售卖房型静态信息同步载荷。
 * @param {object} mapping 房型映射
 * @param {object} payload 同步请求参数
 * @returns {object} 售卖房型同步载荷
 * @throws {Error} 缺少抖音房型 ID 时抛出异常
 */
function buildRatePlanPayload(mapping, payload) {
  const roomId = String(mapping.douyin_room_id || '').trim();
  if (!roomId) {
    throw createDouyinError(
      `房型 ${mapping.local_room_type} 缺少 douyin_room_id，无法同步售卖房型`,
      'DOUYIN_RATEPLAN_ROOM_ID_REQUIRED',
      409
    );
  }

  const outRatePlanId = String(mapping.douyin_rate_plan_id || '').trim()
    || `local_${mapping.local_room_type}`;
  const ratePlanName = String(payload.ratePlanName || '').trim()
    || `${String(mapping.type_name || mapping.local_room_type).trim()}标准价`;

  return {
    room_type: mapping.local_room_type,
    rooms: [
      {
        room_id: roomId,
        rate_plans: [
          {
            out_rate_plan_id: outRatePlanId,
            rate_plan_name: ratePlanName,
            ...buildRatePlanOptionalFields(payload)
          }
        ]
      }
    ]
  };
}

/**
 * 计算指定房型在日期区间内的库存快照。
 * @param {string} roomType 房型编码
 * @param {string[]} stayDates 住宿日列表
 * @returns {Promise<object[]>} 库存快照
 */
async function getInventoryRows(roomType, stayDates) {
  const result = await query(
    `WITH eligible_rooms AS (
       SELECT room_number
         FROM rooms
        WHERE type_code = $1
          AND is_closed = FALSE
          AND status != 'repair'
     ),
     occupied_by_date AS (
       SELECT stay_date, COUNT(DISTINCT room_number)::int AS occupied_count
         FROM orders
        WHERE room_type = $1
          AND status = ANY($2::text[])
          AND stay_date = ANY($3::date[])
        GROUP BY stay_date
     )
     SELECT
       to_char(d::date, 'YYYY-MM-DD') AS stay_date,
       (SELECT COUNT(*) FROM eligible_rooms)::int AS total_rooms,
       COALESCE(obd.occupied_count, 0)::int AS occupied_count
      FROM unnest($3::date[]) d
      LEFT JOIN occupied_by_date obd ON obd.stay_date = d
      ORDER BY d`,
    [roomType, ACTIVE_ORDER_STATUSES, stayDates]
  );

  return result.rows.map((row) => ({
    stay_date: row.stay_date,
    total_rooms: Number(row.total_rooms || 0),
    occupied_count: Number(row.occupied_count || 0),
    available_rooms: Math.max(Number(row.total_rooms || 0) - Number(row.occupied_count || 0), 0)
  }));
}

/**
 * 组装库存同步载荷。
 * @param {object} mapping 房型映射
 * @param {string[]} stayDates 日期列表
 * @returns {Promise<object>} 库存同步载荷
 */
async function buildInventoryPayload(mapping, stayDates) {
  const inventoryRows = await getInventoryRows(mapping.local_room_type, stayDates);
  return {
    sync_type: 'inventory',
    room_type: mapping.local_room_type,
    room_id: mapping.douyin_room_id,
    rate_plan_id: mapping.douyin_rate_plan_id || '',
    items: inventoryRows.map((row) => ({
      // SDK 逐条读取 item 级别标识，避免调用前校验缺少 room_id/rate_plan_id。
      room_id: mapping.douyin_room_id,
      rate_plan_id: mapping.douyin_rate_plan_id || '',
      stay_date: row.stay_date,
      available_rooms: row.available_rooms,
      total_rooms: row.total_rooms
    }))
  };
}

/**
 * 组装价格同步载荷。
 * @param {object} mapping 房型映射
 * @param {string[]} stayDates 日期列表
 * @returns {object} 价格同步载荷
 */
function buildPricePayload(mapping, stayDates) {
  return {
    sync_type: 'price',
    room_type: mapping.local_room_type,
    room_id: mapping.douyin_room_id,
    rate_plan_id: mapping.douyin_rate_plan_id || '',
    items: stayDates.map((stayDate) => ({
      // SDK 逐条读取 item 级别标识，避免调用前校验缺少 room_id/rate_plan_id。
      room_id: mapping.douyin_room_id,
      rate_plan_id: mapping.douyin_rate_plan_id || '',
      stay_date: stayDate,
      price: toAmountNumber(mapping.base_price)
    }))
  };
}

/**
 * 创建或复用待发送 outbox 任务。
 * @param {object} client 数据库连接
 * @param {object} params 任务参数
 * @returns {Promise<object>} 出站任务记录
 */
async function upsertOutboxTask(client, params) {
  const existing = await client.query(
    `SELECT *
       FROM douyin_outbox
      WHERE dedupe_key = $1
        AND task_status = ANY($2::text[])
      LIMIT 1`,
    [params.dedupe_key, OPEN_OUTBOX_STATUSES]
  );

  if (existing.rows.length) {
    return {
      ...existing.rows[0],
      existing: true
    };
  }

  const insertResult = await client.query(
    `INSERT INTO douyin_outbox (
       sync_type, local_room_type, dedupe_key, request_payload,
       task_status, retry_count, next_retry_at, updated_at
     ) VALUES ($1, $2, $3, $4::jsonb, 'pending', 0, now(), now())
     RETURNING *`,
    [
      params.sync_type,
      params.local_room_type,
      params.dedupe_key,
      JSON.stringify(params.request_payload)
    ]
  );

  return {
    ...insertResult.rows[0],
    existing: false
  };
}

/**
 * 创建房态同步任务。
 * @param {object} payload 同步请求
 * @returns {Promise<object>} 创建结果
 * @throws {Error} 参数或映射异常时抛出异常
 */
async function createRoomSyncTasks(payload) {
  const client = await getClient();
  let committed = false;

  try {
    await client.query('BEGIN');

    const normalizedRoomType = payload.roomType ? String(payload.roomType).trim() : null;
    const syncTypes = Array.isArray(payload.syncTypes) && payload.syncTypes.length
      ? [...new Set(payload.syncTypes.map((item) => String(item).trim()))]
      : ['inventory', 'price'];
    const stayDates = await buildDateRange(payload.startDate, payload.endDate, client);
    const mappings = await getSyncMappings(normalizedRoomType, client);

    const jobs = [];
    for (const mapping of mappings) {
      for (const syncType of syncTypes) {
        if (syncType === 'inventory' && !mapping.sync_inventory) continue;
        if (syncType === 'price' && !mapping.sync_price) continue;
        if (!['inventory', 'price'].includes(syncType)) {
          throw createDouyinError(`不支持的同步类型 ${syncType}`, 'DOUYIN_SYNC_TYPE_INVALID');
        }

        const requestPayload = syncType === 'inventory'
          ? await buildInventoryPayload(mapping, stayDates)
          : buildPricePayload(mapping, stayDates);
        const dedupeKey = [
          syncType,
          mapping.local_room_type,
          mapping.douyin_room_id,
          stayDates[0],
          stayDates[stayDates.length - 1]
        ].join(':');

        jobs.push(await upsertOutboxTask(client, {
          sync_type: syncType,
          local_room_type: mapping.local_room_type,
          dedupe_key: dedupeKey,
          request_payload: requestPayload
        }));
      }
    }

    await client.query('COMMIT');
    committed = true;
    return {
      room_type: normalizedRoomType,
      start_date: stayDates[0],
      end_date: stayDates[stayDates.length - 1],
      jobs
    };
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 创建售卖房型静态信息同步任务。
 * @param {object} payload 同步请求
 * @returns {Promise<object>} 创建结果
 * @throws {Error} 参数或映射异常时抛出异常
 */
async function createRatePlanSyncTasks(payload) {
  const client = await getClient();
  let committed = false;

  try {
    await client.query('BEGIN');

    const normalizedRoomType = payload.roomType ? String(payload.roomType).trim() : null;
    const mappings = await getSyncMappings(normalizedRoomType, client);

    const jobs = [];
    for (const mapping of mappings) {
      const requestPayload = buildRatePlanPayload(mapping, payload);
      const payloadHash = buildPayloadHash(requestPayload);
      const dedupeKey = [
        'rateplan',
        mapping.local_room_type,
        mapping.douyin_room_id,
        payloadHash
      ].join(':');

      jobs.push(await upsertOutboxTask(client, {
        sync_type: 'rateplan',
        local_room_type: mapping.local_room_type,
        dedupe_key: dedupeKey,
        request_payload: requestPayload
      }));
    }

    await client.query('COMMIT');
    committed = true;
    return {
      room_type: normalizedRoomType,
      jobs
    };
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 按任务 ID 处理单条 outbox 任务。
 * @param {number} taskId 任务 ID
 * @returns {Promise<object>} 处理后的任务信息
 * @throws {Error} 任务不存在时抛出异常
 */
async function processOutboxTask(taskId) {
  const client = await getClient();
  let committed = false;

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT *
         FROM douyin_outbox
        WHERE id = $1
        LIMIT 1
        FOR UPDATE`,
      [taskId]
    );

    if (!result.rows.length) {
      throw createDouyinError('同步任务不存在', 'DOUYIN_OUTBOX_TASK_NOT_FOUND', 404);
    }

    const task = result.rows[0];
    await client.query(
      `UPDATE douyin_outbox
          SET task_status = 'processing',
              updated_at = now()
        WHERE id = $1`,
      [task.id]
    );

    const accountConfig = await getEnabledAccountConfig();
    try {
      const responsePayload = await sendSyncRequest(accountConfig, task);
      await client.query(
        `UPDATE douyin_outbox
            SET task_status = 'sent',
                last_error = NULL,
                updated_at = now()
          WHERE id = $1`,
        [task.id]
      );
      await client.query('COMMIT');
      committed = true;
      return {
        ...task,
        task_status: 'sent',
        response_payload: responsePayload
      };
    } catch (error) {
      const logIdMatch = String(error?.message || '').match(/logid\s+is\s+([a-zA-Z0-9]+)/i);
      const extractedLogId = logIdMatch ? String(logIdMatch[1] || '').trim() : null;
      await client.query(
        `UPDATE douyin_outbox
            SET task_status = 'retrying',
                retry_count = retry_count + 1,
                last_error = $2,
                next_retry_at = now() + INTERVAL '5 minutes',
                updated_at = now()
          WHERE id = $1`,
        [task.id, error.message]
      );
      await client.query('COMMIT');
      committed = true;
      return {
        ...task,
        task_status: 'retrying',
        retry_count: Number(task.retry_count || 0) + 1,
        last_error: error.message,
        last_logid: extractedLogId
      };
    }
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 获取待处理同步任务列表。
 * @returns {Promise<object[]>} 同步任务列表
 */
async function getOutboxTasks() {
  const result = await query(
    `SELECT *
       FROM douyin_outbox
      ORDER BY created_at DESC, id DESC`
  );
  return result.rows;
}

/**
 * 批量消费到期的 outbox 任务。
 * @param {number} limit 单次最多处理数量
 * @returns {Promise<object[]>} 处理结果列表
 */
async function processPendingOutboxTasks(limit = 10) {
  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
  const result = await query(
    `SELECT id
       FROM douyin_outbox
      WHERE task_status IN ('pending', 'retrying')
        AND next_retry_at <= now()
      ORDER BY next_retry_at, id
      LIMIT $1`,
    [normalizedLimit]
  );

  const processedResults = [];
  for (const row of result.rows) {
    processedResults.push(await processOutboxTask(row.id));
  }
  return processedResults;
}

module.exports = {
  createRoomSyncTasks,
  createRatePlanSyncTasks,
  getOutboxTasks,
  processOutboxTask,
  processPendingOutboxTasks
};
