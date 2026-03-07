"use strict";

const { nanoid } = require('nanoid');
const { query, getClient } = require('../database/postgreDB/pg');
const orderModule = require('./orderModule');
const { formatDate, toAmountNumber } = require('./tools');

const ACTIVE_ORDER_STATUSES = ['pending', 'reserved', 'checked-in', 'occupied'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// OTA 模块统一返回带 code/statusCode 的业务错误，避免路由层重复判断。
function createOtaError(message, code, statusCode = 400, details = null) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

function normalizeOtaOrderPayload(payload = {}) {
  let checkInDate = null;
  let checkOutDate = null;

  try {
    checkInDate = formatDate(payload.checkInDate || payload.check_in_date);
    checkOutDate = formatDate(payload.checkOutDate || payload.check_out_date);
  } catch (error) {
    throw createOtaError(error.message, 'OTA_ORDER_DATE_INVALID');
  }

  const normalized = {
    externalOrderId: String(
      payload.externalOrderId
      || payload.external_order_id
      || payload.orderId
      || payload.order_id
      || ''
    ).trim(),
    guestName: String(payload.guestName || payload.guest_name || '').trim(),
    phone: payload.phone === undefined || payload.phone === null ? '' : String(payload.phone).trim(),
    roomType: String(payload.roomType || payload.room_type || '').trim(),
    checkInDate,
    checkOutDate,
    remarks: payload.remarks ? String(payload.remarks) : '',
    paymentMethod: String(payload.paymentMethod || payload.payment_method || '平台').trim() || '平台',
    totalPrice: payload.totalPrice ?? payload.total_price,
    dailyPrices: payload.dailyPrices || payload.daily_prices || payload.roomPrice || payload.room_price || null
  };

  if (!normalized.externalOrderId) {
    throw createOtaError('缺少 OTA 外部订单号', 'OTA_ORDER_ID_REQUIRED');
  }
  if (!normalized.guestName) {
    throw createOtaError('缺少客人姓名', 'OTA_GUEST_NAME_REQUIRED');
  }
  if (!normalized.roomType) {
    throw createOtaError('缺少房型编码', 'OTA_ROOM_TYPE_REQUIRED');
  }
  if (!normalized.checkInDate || !DATE_REGEX.test(normalized.checkInDate)) {
    throw createOtaError('入住日期格式错误', 'OTA_CHECK_IN_DATE_INVALID');
  }
  if (!normalized.checkOutDate || !DATE_REGEX.test(normalized.checkOutDate)) {
    throw createOtaError('退房日期格式错误', 'OTA_CHECK_OUT_DATE_INVALID');
  }

  return normalized;
}

async function generateStayDates(checkInDate, checkOutDate, client = null) {
  const runner = client || { query };
  if (!checkInDate) {
    return [];
  }

  // 日期展开逻辑与现有订单分行保持一致：普通订单按 [checkIn, checkOut)。
  if (!checkOutDate || checkOutDate <= checkInDate) {
    return [checkInDate];
  }

  const result = await runner.query(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS stay_date
       FROM generate_series($1::date, ($2::date - INTERVAL '1 day'), INTERVAL '1 day') d`,
    [checkInDate, checkOutDate]
  );
  return result.rows.map((row) => row.stay_date);
}

async function buildDailyPrices(normalizedPayload) {
  if (normalizedPayload.dailyPrices && typeof normalizedPayload.dailyPrices === 'object' && !Array.isArray(normalizedPayload.dailyPrices)) {
    const stayDates = await generateStayDates(normalizedPayload.checkInDate, normalizedPayload.checkOutDate);
    const priceMap = {};

    for (const stayDate of stayDates) {
      if (normalizedPayload.dailyPrices[stayDate] === undefined) {
        throw createOtaError(`缺少 ${stayDate} 的每日房价`, 'OTA_DAILY_PRICE_MISSING');
      }
      priceMap[stayDate] = toAmountNumber(normalizedPayload.dailyPrices[stayDate]);
      if (!(priceMap[stayDate] > 0)) {
        throw createOtaError(`${stayDate} 的每日房价无效`, 'OTA_DAILY_PRICE_INVALID');
      }
    }

    const dailyPriceKeys = Object.keys(normalizedPayload.dailyPrices);
    const hasUnexpectedDates = dailyPriceKeys.some((dateKey) => !stayDates.includes(formatDate(dateKey)));
    if (hasUnexpectedDates) {
      throw createOtaError('每日房价日期与入住区间不匹配', 'OTA_DAILY_PRICE_RANGE_INVALID');
    }

    return priceMap;
  }

  const totalPrice = toAmountNumber(normalizedPayload.totalPrice);
  if (!(totalPrice > 0)) {
    throw createOtaError('缺少有效的订单总价', 'OTA_TOTAL_PRICE_INVALID');
  }

  // 复用现有订单模块的金额分摊口径，避免 OTA 与前台创建订单算出不同的日价。
  const result = await orderModule.getPricingBreakdown({
    checkInDate: normalizedPayload.checkInDate,
    checkOutDate: normalizedPayload.checkOutDate,
    mode: 'distribute-total',
    totalPrice
  });

  return result.daily_prices || {};
}

async function getExistingOrderBySourceAndId(channelCode, externalOrderId, client = null) {
  const runner = client || { query };
  const result = await runner.query(
    `SELECT order_id
       FROM orders
      WHERE order_source = $1
        AND id_source = $2
      ORDER BY create_time DESC
      LIMIT 1`,
    [channelCode, externalOrderId]
  );

  if (!result.rows.length) {
    return null;
  }

  return orderModule.getOrderById(result.rows[0].order_id);
}

async function getInventoryRows(channelCode, startDate, endDate, roomType = null, client = null) {
  const runner = client || { query };
  let normalizedStartDate = null;
  let normalizedEndDate = null;

  try {
    normalizedStartDate = formatDate(startDate);
    normalizedEndDate = formatDate(endDate);
  } catch (error) {
    throw createOtaError(error.message, 'OTA_INVENTORY_DATE_INVALID');
  }

  if (!normalizedStartDate || !DATE_REGEX.test(normalizedStartDate)) {
    throw createOtaError('startDate 格式错误', 'OTA_INVENTORY_START_DATE_INVALID');
  }
  if (!normalizedEndDate || !DATE_REGEX.test(normalizedEndDate)) {
    throw createOtaError('endDate 格式错误', 'OTA_INVENTORY_END_DATE_INVALID');
  }
  if (normalizedEndDate < normalizedStartDate) {
    throw createOtaError('endDate 不能早于 startDate', 'OTA_INVENTORY_DATE_RANGE_INVALID');
  }

  const normalizedRoomType = roomType ? String(roomType).trim() : null;
  const result = await runner.query(
    `WITH requested_dates AS (
       SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS stay_date
     ),
     eligible_rooms AS (
       SELECT r.room_number, r.type_code
         FROM rooms r
        WHERE r.is_closed = FALSE
          AND r.status != 'repair'
          AND ($4::text IS NULL OR r.type_code = $4)
     ),
     room_type_scope AS (
       SELECT DISTINCT er.type_code AS room_type
         FROM eligible_rooms er
       UNION
       SELECT DISTINCT q.room_type
         FROM ota_inventory_quota q
        WHERE q.channel_code = $1
          AND q.stay_date >= $2::date
          AND q.stay_date <= $3::date
          AND ($4::text IS NULL OR q.room_type = $4)
     ),
     occupied_rooms AS (
       SELECT o.stay_date, o.room_type, COUNT(DISTINCT o.room_number)::int AS occupied_count
         FROM orders o
         JOIN rooms r ON r.room_number = o.room_number
        WHERE o.status = ANY($5::text[])
          AND o.stay_date >= $2::date
          AND o.stay_date <= $3::date
          AND r.is_closed = FALSE
          AND r.status != 'repair'
          AND ($4::text IS NULL OR o.room_type = $4)
        GROUP BY o.stay_date, o.room_type
     ),
     quota_rows AS (
       SELECT q.room_type, q.stay_date, q.quota
         FROM ota_inventory_quota q
        WHERE q.channel_code = $1
          AND q.stay_date >= $2::date
          AND q.stay_date <= $3::date
          AND ($4::text IS NULL OR q.room_type = $4)
     )
     SELECT
       to_char(d.stay_date, 'YYYY-MM-DD') AS stay_date,
       s.room_type,
       COUNT(er.room_number)::int AS total_rooms,
       GREATEST(COUNT(er.room_number)::int - COALESCE(o.occupied_count, 0), 0)::int AS physical_available,
       q.quota AS quota_limit,
       GREATEST(
         LEAST(
           GREATEST(COUNT(er.room_number)::int - COALESCE(o.occupied_count, 0), 0),
           COALESCE(q.quota, GREATEST(COUNT(er.room_number)::int - COALESCE(o.occupied_count, 0), 0))
         ),
         0
       )::int AS sellable_available
      FROM requested_dates d
      CROSS JOIN room_type_scope s
      LEFT JOIN eligible_rooms er ON er.type_code = s.room_type
      LEFT JOIN occupied_rooms o ON o.stay_date = d.stay_date AND o.room_type = s.room_type
      LEFT JOIN quota_rows q ON q.stay_date = d.stay_date AND q.room_type = s.room_type
     GROUP BY d.stay_date, s.room_type, o.occupied_count, q.quota
     ORDER BY d.stay_date, s.room_type`,
    [channelCode, normalizedStartDate, normalizedEndDate, normalizedRoomType, ACTIVE_ORDER_STATUSES]
  );

  return result.rows.map((row) => ({
    stay_date: row.stay_date,
    room_type: row.room_type,
    total_rooms: Number(row.total_rooms || 0),
    physical_available: Number(row.physical_available || 0),
    quota_limit: row.quota_limit === null || row.quota_limit === undefined ? null : Number(row.quota_limit),
    sellable_available: Number(row.sellable_available || 0)
  }));
}

async function assertRoomTypeExists(roomType, client) {
  const result = await client.query(
    `SELECT 1 FROM room_types WHERE type_code = $1`,
    [roomType]
  );

  if (!result.rows.length) {
    throw createOtaError(`房型 ${roomType} 不存在`, 'OTA_ROOM_TYPE_NOT_FOUND');
  }
}

async function assertSellableInventory(channelCode, roomType, stayDates, client) {
  if (!Array.isArray(stayDates) || !stayDates.length) {
    throw createOtaError('订单日期范围无效', 'OTA_STAY_DATES_EMPTY');
  }

  const inventoryRows = await getInventoryRows(
    channelCode,
    stayDates[0],
    stayDates[stayDates.length - 1],
    roomType,
    client
  );

  const unavailableRows = inventoryRows.filter((row) => stayDates.includes(row.stay_date) && row.sellable_available <= 0);
  if (unavailableRows.length) {
    throw createOtaError('库存不足，无法创建 OTA 订单', 'OTA_INVENTORY_CONFLICT', 409, unavailableRows);
  }
}

async function allocateRoomNumber(roomType, checkInDate, checkOutDate, client) {
  // 通过锁定 rooms 行来实现“同一时刻只会有一个请求拿到最后一间房”。
  const result = await client.query(
    `SELECT r.room_number
       FROM rooms r
      WHERE r.type_code = $1
        AND r.is_closed = FALSE
        AND r.status != 'repair'
        AND NOT EXISTS (
          SELECT 1
            FROM orders o
           WHERE o.room_number = r.room_number
             AND o.status = ANY($4::text[])
             AND o.stay_date >= $2::date
             AND o.stay_date < (
               CASE
                 WHEN $2::date = $3::date THEN ($2::date + INTERVAL '1 day')
                 ELSE $3::date
               END
             )
        )
      ORDER BY r.room_number
      FOR UPDATE SKIP LOCKED
      LIMIT 1`,
    [roomType, checkInDate, checkOutDate, ACTIVE_ORDER_STATUSES]
  );

  if (!result.rows.length) {
    throw createOtaError('没有可分配的房间，无法创建 OTA 订单', 'OTA_ROOM_NOT_AVAILABLE', 409);
  }

  return result.rows[0].room_number;
}

function buildInternalOrderId(channelCode) {
  const normalizedChannelCode = String(channelCode || 'ota').trim().toUpperCase();
  return `OTA-${normalizedChannelCode}-${Date.now()}-${nanoid(6)}`;
}

async function createOtaOrder(channelCode, payload) {
  const normalizedPayload = normalizeOtaOrderPayload(payload);
  const roomPrice = await buildDailyPrices(normalizedPayload);
  const stayDates = Object.keys(roomPrice).sort();
  const client = await getClient();
  let finalized = false;

  try {
    await client.query('BEGIN');

    // 幂等查询放在事务里，减少并发重复推单造成的竞态窗口。
    const existingOrder = await getExistingOrderBySourceAndId(channelCode, normalizedPayload.externalOrderId, client);
    if (existingOrder) {
      await client.query('COMMIT');
      finalized = true;
      return {
        success: true,
        existing: true,
        data: {
          order: existingOrder
        }
      };
    }

    await assertRoomTypeExists(normalizedPayload.roomType, client);
    // 同房型 OTA 分房串行化，避免并发请求在快照窗口内重复拿到同一间房。
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`ota-room-type:${normalizedPayload.roomType}`]
    );
    await assertSellableInventory(channelCode, normalizedPayload.roomType, stayDates, client);
    const roomNumber = await allocateRoomNumber(
      normalizedPayload.roomType,
      normalizedPayload.checkInDate,
      normalizedPayload.checkOutDate,
      client
    );

    const internalOrderId = buildInternalOrderId(channelCode);
    await orderModule.createOrder({
      orderId: internalOrderId,
      sourceNumber: normalizedPayload.externalOrderId,
      orderSource: channelCode,
      guestName: normalizedPayload.guestName,
      phone: normalizedPayload.phone,
      roomType: normalizedPayload.roomType,
      roomNumber,
      checkInDate: normalizedPayload.checkInDate,
      checkOutDate: normalizedPayload.checkOutDate,
      status: 'pending',
      paymentMethod: normalizedPayload.paymentMethod,
      roomPrice,
      deposit: 0,
      isPrepaid: false,
      prepaidAmount: 0,
      stayType: normalizedPayload.checkInDate === normalizedPayload.checkOutDate ? '休息房' : '客房',
      remarks: normalizedPayload.remarks
    }, client);

    await client.query('COMMIT');
    finalized = true;
    const createdOrder = await orderModule.getOrderById(internalOrderId);

    return {
      success: true,
      existing: false,
      data: {
        order: createdOrder
      }
    };
  } catch (error) {
    if (!finalized) {
      await client.query('ROLLBACK');
      finalized = true;
    }

    if (error.code === '23505') {
      const existingOrder = await getExistingOrderBySourceAndId(channelCode, normalizedPayload.externalOrderId);
      if (existingOrder) {
        return {
          success: true,
          existing: true,
          data: {
            order: existingOrder
          }
        };
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

async function setInventoryQuota(channelCode, entries = [], updatedBy = 'ota_api') {
  if (!Array.isArray(entries) || !entries.length) {
    throw createOtaError('库存更新 entries 不能为空', 'OTA_INVENTORY_ENTRIES_REQUIRED');
  }

  const client = await getClient();
  let committed = false;
  try {
    await client.query('BEGIN');

    const results = [];
    for (const entry of entries) {
      const roomType = String(entry.roomType || entry.room_type || '').trim();
      const stayDate = formatDate(entry.stayDate || entry.stay_date);
      const quota = entry.quota;

      if (!roomType) {
        throw createOtaError('库存更新缺少 roomType', 'OTA_INVENTORY_ROOM_TYPE_REQUIRED');
      }
      if (!stayDate || !DATE_REGEX.test(stayDate)) {
        throw createOtaError('库存更新 stayDate 格式错误', 'OTA_INVENTORY_STAY_DATE_INVALID');
      }
      if (quota !== null && quota !== undefined) {
        const quotaNumber = Number(quota);
        if (!Number.isInteger(quotaNumber) || quotaNumber < 0) {
          throw createOtaError('库存配额必须为大于等于 0 的整数', 'OTA_INVENTORY_QUOTA_INVALID');
        }
      }

      const roomTypeCheck = await client.query(
        `SELECT 1 FROM room_types WHERE type_code = $1`,
        [roomType]
      );
      if (!roomTypeCheck.rows.length) {
        throw createOtaError(`房型 ${roomType} 不存在`, 'OTA_INVENTORY_ROOM_TYPE_NOT_FOUND', 400);
      }

      // quota=null 代表移除 OTA 配额限制，恢复为纯物理库存口径。
      if (quota === null || quota === undefined) {
        await client.query(
          `DELETE FROM ota_inventory_quota
            WHERE channel_code = $1
              AND room_type = $2
              AND stay_date = $3::date`,
          [channelCode, roomType, stayDate]
        );
      } else {
        await client.query(
          `INSERT INTO ota_inventory_quota (
             channel_code, room_type, stay_date, quota, updated_at, updated_by
           ) VALUES ($1, $2, $3::date, $4, now(), $5)
           ON CONFLICT (channel_code, room_type, stay_date)
           DO UPDATE SET
             quota = EXCLUDED.quota,
             updated_at = now(),
             updated_by = EXCLUDED.updated_by`,
          [channelCode, roomType, stayDate, Number(quota), String(updatedBy || 'ota_api')]
        );
      }

      results.push({
        room_type: roomType,
        stay_date: stayDate,
        quota_limit: quota === null || quota === undefined ? null : Number(quota)
      });
    }

    await client.query('COMMIT');
    committed = true;

    const affectedDates = results.map((item) => item.stay_date).sort();
    const affectedRoomTypes = [...new Set(results.map((item) => item.room_type))];
    const refreshedRows = [];

    for (const roomType of affectedRoomTypes) {
      const rows = await getInventoryRows(
        channelCode,
        affectedDates[0],
        affectedDates[affectedDates.length - 1],
        roomType
      );
      refreshedRows.push(...rows.filter((row) => affectedDates.includes(row.stay_date)));
    }

    return refreshedRows.sort((left, right) => {
      if (left.stay_date === right.stay_date) {
        return left.room_type.localeCompare(right.room_type);
      }
      return left.stay_date.localeCompare(right.stay_date);
    });
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createOtaError,
  createOtaOrder,
  getInventoryRows,
  normalizeOtaOrderPayload,
  setInventoryQuota
};
