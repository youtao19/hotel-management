"use strict";

const { nanoid } = require('nanoid');
const { getClient, query } = require('../../../database/postgreDB/pg');
const orderModule = require('../../orderModule');
const { formatDate, toAmountNumber } = require('../../tools');
const { createDouyinError } = require('./error');

const ACTIVE_ORDER_STATUSES = ['pending', 'reserved', 'checked-in', 'occupied'];

/**
 * 根据入住和离店日期展开住宿日。
 * @param {string} checkInDate 入住日
 * @param {string} checkOutDate 离店日
 * @param {object} client 数据库连接
 * @returns {Promise<string[]>} 住宿日列表
 * @throws {Error} 日期无效时抛出异常
 */
async function buildStayDates(checkInDate, checkOutDate, client) {
  const normalizedCheckInDate = formatDate(checkInDate);
  const normalizedCheckOutDate = formatDate(checkOutDate);
  if (!normalizedCheckInDate) {
    throw createDouyinError('入住日期不能为空', 'DOUYIN_ORDER_CHECK_IN_REQUIRED');
  }

  if (!normalizedCheckOutDate || normalizedCheckOutDate <= normalizedCheckInDate) {
    return [normalizedCheckInDate];
  }

  const result = await client.query(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS stay_date
       FROM generate_series($1::date, ($2::date - INTERVAL '1 day'), INTERVAL '1 day') d`,
    [normalizedCheckInDate, normalizedCheckOutDate]
  );
  return result.rows.map((row) => row.stay_date);
}

/**
 * 生成抖音内部确认号。
 * @returns {string} 酒店确认号
 */
function buildHotelConfirmNumber() {
  return `DYCF${Date.now()}${nanoid(4).toUpperCase()}`;
}

/**
 * 生成内部订单号。
 * @returns {string} 内部订单号
 */
function buildInternalOrderId() {
  return `OTA-DY-${Date.now()}-${nanoid(6)}`;
}

/**
 * 将总价展开为每日价格。
 * @param {object} payload 入站请求
 * @param {number} basePrice 本地房型基准价
 * @returns {Promise<object>} 每日房价映射
 * @throws {Error} 价格异常时抛出异常
 */
async function normalizeDailyPrices(payload, basePrice) {
  const expectedByBasePrice = await orderModule.getPricingBreakdown({
    checkInDate: payload.check_in_date || payload.checkInDate,
    checkOutDate: payload.check_out_date || payload.checkOutDate,
    mode: 'from-room-price',
    basePrice
  });
  const dailyPrices = payload.daily_prices || payload.dailyPrices || null;
  if (dailyPrices && typeof dailyPrices === 'object' && !Array.isArray(dailyPrices)) {
    const normalized = {};
    for (const [dateKey, rawPrice] of Object.entries(dailyPrices)) {
      normalized[formatDate(dateKey)] = toAmountNumber(rawPrice);
    }
    const actualTotal = toAmountNumber(
      Object.values(normalized).reduce((sum, value) => sum + (Number(value) || 0), 0)
    );
    if (actualTotal !== toAmountNumber(expectedByBasePrice.total_price)) {
      throw createDouyinError(
        '抖音订单价格与本地房型价格不一致',
        'DOUYIN_ORDER_PRICE_MISMATCH',
        409,
        {
          expected_total_price: expectedByBasePrice.total_price,
          requested_total_price: actualTotal
        }
      );
    }
    return normalized;
  }

  const totalPrice = payload.total_price ?? payload.totalPrice;
  const breakdown = await orderModule.getPricingBreakdown({
    checkInDate: payload.check_in_date || payload.checkInDate,
    checkOutDate: payload.check_out_date || payload.checkOutDate,
    mode: 'distribute-total',
    totalPrice
  });

  const requestedTotal = toAmountNumber(totalPrice);
  if (toAmountNumber(expectedByBasePrice.total_price) !== requestedTotal) {
    throw createDouyinError(
      '抖音订单价格与本地房型价格不一致',
      'DOUYIN_ORDER_PRICE_MISMATCH',
      409,
      {
        expected_total_price: expectedByBasePrice.total_price,
        requested_total_price: requestedTotal
      }
    );
  }

  return breakdown.daily_prices;
}

/**
 * 根据抖音房型映射定位本地房型。
 * @param {object} payload 入站请求
 * @param {object} client 数据库连接
 * @returns {Promise<object>} 房型映射记录
 * @throws {Error} 映射不存在时抛出异常
 */
async function getRoomMapping(payload, client) {
  const douyinRoomId = String(payload.room_id || payload.roomId || '').trim();
  const ratePlanId = String(payload.rate_plan_id || payload.ratePlanId || '').trim();

  const result = await client.query(
    `SELECT m.*, rt.base_price
       FROM douyin_room_mapping m
       JOIN room_types rt ON rt.type_code = m.local_room_type
      WHERE m.enabled = TRUE
        AND m.douyin_room_id = $1
        AND (
          NULLIF(TRIM($2), '') IS NULL
          OR COALESCE(m.douyin_rate_plan_id, '') = TRIM($2)
        )
      LIMIT 1`,
    [douyinRoomId, ratePlanId]
  );

  if (!result.rows.length) {
    throw createDouyinError('抖音房型映射不存在', 'DOUYIN_ROOM_MAPPING_NOT_FOUND', 404, {
      room_id: douyinRoomId,
      rate_plan_id: ratePlanId || null
    });
  }

  return result.rows[0];
}

/**
 * 查询现有抖音订单。
 * @param {string} douyinOrderId 抖音订单号
 * @param {string|null} orderOutId 外部订单号
 * @param {object} client 数据库连接
 * @returns {Promise<object|null>} 已存在订单
 */
async function getExistingDouyinOrder(douyinOrderId, orderOutId, client) {
  const result = await client.query(
    `SELECT *
       FROM douyin_order
      WHERE douyin_order_id = $1
         OR ($2::text IS NOT NULL AND order_out_id = $2)
      ORDER BY created_at DESC
      LIMIT 1`,
    [douyinOrderId, orderOutId]
  );
  return result.rows[0] || null;
}

/**
 * 校验指定住宿日是否仍有可售库存。
 * @param {string} roomType 本地房型
 * @param {string[]} stayDates 住宿日列表
 * @param {object} client 数据库连接
 * @returns {Promise<void>}
 * @throws {Error} 无库存时抛出异常
 */
async function assertInventoryAvailable(roomType, stayDates, client) {
  const result = await client.query(
    `WITH eligible_rooms AS (
       SELECT room_number
         FROM rooms
        WHERE type_code = $1
          AND is_closed = FALSE
          AND status != 'repair'
     ),
     occupied_by_date AS (
       SELECT o.stay_date, COUNT(DISTINCT o.room_number)::int AS occupied_count
         FROM orders o
         JOIN rooms r ON r.room_number = o.room_number
        WHERE o.room_type = $1
          AND o.status = ANY($2::text[])
          AND o.stay_date = ANY($3::date[])
          AND r.is_closed = FALSE
          AND r.status != 'repair'
        GROUP BY o.stay_date
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

  const conflicts = result.rows.filter((row) => Number(row.total_rooms || 0) - Number(row.occupied_count || 0) <= 0);
  if (conflicts.length) {
    throw createDouyinError('指定日期库存不足', 'DOUYIN_INVENTORY_CONFLICT', 409, conflicts);
  }
}

/**
 * 为抖音订单分配房间。
 * @param {string} roomType 房型编码
 * @param {string} checkInDate 入住日
 * @param {string} checkOutDate 离店日
 * @param {object} client 数据库连接
 * @returns {Promise<string>} 房号
 * @throws {Error} 无房可分配时抛出异常
 */
async function allocateRoomNumber(roomType, checkInDate, checkOutDate, client) {
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
    throw createDouyinError('没有可分配的房间', 'DOUYIN_ROOM_NOT_AVAILABLE', 409);
  }
  return result.rows[0].room_number;
}

/**
 * 记录抖音事件流水。
 * @param {object} client 数据库连接
 * @param {object} eventData 事件数据
 * @returns {Promise<void>}
 */
async function insertOrderEvent(client, eventData) {
  await client.query(
    `INSERT INTO douyin_order_event (
       douyin_order_id, order_out_id, internal_order_id, event_type, direction,
       event_status, idempotency_key, request_payload, response_payload, error_message
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)
     ON CONFLICT (idempotency_key)
     DO UPDATE SET
       response_payload = EXCLUDED.response_payload,
       error_message = EXCLUDED.error_message,
       event_status = EXCLUDED.event_status`,
    [
      eventData.douyin_order_id || null,
      eventData.order_out_id || null,
      eventData.internal_order_id || null,
      eventData.event_type,
      eventData.direction,
      eventData.event_status || 'processed',
      eventData.idempotency_key,
      JSON.stringify(eventData.request_payload || null),
      JSON.stringify(eventData.response_payload || null),
      eventData.error_message || null
    ]
  );
}

/**
 * 创建抖音订单。
 * @param {object} payload 抖音创单请求
 * @returns {Promise<object>} 创单结果
 * @throws {Error} 创单失败时抛出异常
 */
async function createDouyinOrder(payload) {
  const client = await getClient();
  let committed = false;

  try {
    await client.query('BEGIN');

    const douyinOrderId = String(payload.douyin_order_id || payload.douyinOrderId || '').trim();
    const orderOutId = String(payload.order_out_id || payload.orderOutId || '').trim() || null;
    if (!douyinOrderId) {
      throw createDouyinError('缺少抖音订单号', 'DOUYIN_ORDER_ID_REQUIRED');
    }

    const existingOrder = await getExistingDouyinOrder(douyinOrderId, orderOutId, client);
    if (existingOrder) {
      await insertOrderEvent(client, {
        douyin_order_id: douyinOrderId,
        order_out_id: orderOutId,
        internal_order_id: existingOrder.internal_order_id,
        event_type: 'order_create',
        direction: 'inbound',
        idempotency_key: `douyin:create:${douyinOrderId}:${orderOutId || ''}`,
        request_payload: payload,
        response_payload: existingOrder
      });
      await client.query('COMMIT');
      committed = true;
      return {
        existing: true,
        data: existingOrder
      };
    }

    const mapping = await getRoomMapping(payload, client);
    const stayDates = await buildStayDates(payload.check_in_date || payload.checkInDate, payload.check_out_date || payload.checkOutDate, client);
    const dailyPrices = await normalizeDailyPrices(payload, Number(mapping.base_price || 0));
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`douyin-room-type:${mapping.local_room_type}`]);
    await assertInventoryAvailable(mapping.local_room_type, stayDates, client);

    const roomNumber = await allocateRoomNumber(
      mapping.local_room_type,
      formatDate(payload.check_in_date || payload.checkInDate),
      formatDate(payload.check_out_date || payload.checkOutDate),
      client
    );

    const internalOrderId = buildInternalOrderId();
    const hotelConfirmNumber = buildHotelConfirmNumber();

    await orderModule.createOrder({
      orderId: internalOrderId,
      sourceNumber: orderOutId || douyinOrderId,
      orderSource: 'douyin',
      guestName: String(payload.guest_name || payload.guestName || '').trim() || '抖音客人',
      phone: String(payload.phone || '').trim(),
      roomType: mapping.local_room_type,
      roomNumber,
      checkInDate: payload.check_in_date || payload.checkInDate,
      checkOutDate: payload.check_out_date || payload.checkOutDate,
      status: 'pending',
      paymentMethod: String(payload.payment_method || payload.paymentMethod || '平台').trim() || '平台',
      roomPrice: dailyPrices,
      deposit: 0,
      isPrepaid: false,
      prepaidAmount: 0,
      stayType: formatDate(payload.check_in_date || payload.checkInDate) === formatDate(payload.check_out_date || payload.checkOutDate) ? '休息房' : '客房',
      remarks: String(payload.remarks || '抖音直连订单').trim()
    }, client);

    const douyinOrderRow = {
      internal_order_id: internalOrderId,
      douyin_order_id: douyinOrderId,
      order_out_id: orderOutId,
      hotel_confirm_number: hotelConfirmNumber,
      local_room_type: mapping.local_room_type,
      douyin_room_id: mapping.douyin_room_id,
      douyin_rate_plan_id: mapping.douyin_rate_plan_id || '',
      order_status: 'confirmed',
      pay_status: String(payload.pay_status || 'unpaid'),
      cancel_status: 'none',
      raw_create_payload: payload
    };

    await client.query(
      `INSERT INTO douyin_order (
         internal_order_id, douyin_order_id, order_out_id, hotel_confirm_number,
         local_room_type, douyin_room_id, douyin_rate_plan_id, order_status,
         pay_status, cancel_status, raw_create_payload, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())`,
      [
        douyinOrderRow.internal_order_id,
        douyinOrderRow.douyin_order_id,
        douyinOrderRow.order_out_id,
        douyinOrderRow.hotel_confirm_number,
        douyinOrderRow.local_room_type,
        douyinOrderRow.douyin_room_id,
        douyinOrderRow.douyin_rate_plan_id,
        douyinOrderRow.order_status,
        douyinOrderRow.pay_status,
        douyinOrderRow.cancel_status,
        JSON.stringify(payload)
      ]
    );

    await insertOrderEvent(client, {
      douyin_order_id: douyinOrderId,
      order_out_id: orderOutId,
      internal_order_id: internalOrderId,
      event_type: 'order_create',
      direction: 'inbound',
      idempotency_key: `douyin:create:${douyinOrderId}:${orderOutId || ''}`,
      request_payload: payload,
      response_payload: douyinOrderRow
    });

    await client.query('COMMIT');
    committed = true;
    return {
      existing: false,
      data: douyinOrderRow
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
 * 取消抖音订单。
 * @param {object} payload 抖音取消请求
 * @returns {Promise<object>} 取消结果
 * @throws {Error} 取消失败时抛出异常
 */
async function cancelDouyinOrder(payload) {
  const client = await getClient();
  let committed = false;

  try {
    await client.query('BEGIN');

    const douyinOrderId = String(payload.douyin_order_id || payload.douyinOrderId || '').trim();
    const orderOutId = String(payload.order_out_id || payload.orderOutId || '').trim() || null;
    if (!douyinOrderId && !orderOutId) {
      throw createDouyinError('缺少可识别的抖音订单号', 'DOUYIN_CANCEL_ORDER_ID_REQUIRED');
    }

    const result = await client.query(
      `SELECT *
         FROM douyin_order
        WHERE ($1::text IS NOT NULL AND douyin_order_id = $1)
           OR ($2::text IS NOT NULL AND order_out_id = $2)
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [douyinOrderId || null, orderOutId]
    );

    if (!result.rows.length) {
      throw createDouyinError('抖音订单不存在', 'DOUYIN_ORDER_NOT_FOUND', 404);
    }

    const douyinOrderRow = result.rows[0];
    if (douyinOrderRow.cancel_status === 'cancelled') {
      await insertOrderEvent(client, {
        douyin_order_id: douyinOrderRow.douyin_order_id,
        order_out_id: douyinOrderRow.order_out_id,
        internal_order_id: douyinOrderRow.internal_order_id,
        event_type: 'order_cancel',
        direction: 'inbound',
        idempotency_key: `douyin:cancel:${douyinOrderRow.douyin_order_id}`,
        request_payload: payload,
        response_payload: { already_cancelled: true }
      });
      await client.query('COMMIT');
      committed = true;
      return {
        cancelled: true,
        alreadyCancelled: true,
        data: douyinOrderRow
      };
    }

    const internalOrderRows = await client.query(
      `SELECT *
         FROM orders
        WHERE order_id = $1
        ORDER BY stay_date`,
      [douyinOrderRow.internal_order_id]
    );

    if (!internalOrderRows.rows.length) {
      throw createDouyinError('内部订单不存在', 'DOUYIN_INTERNAL_ORDER_NOT_FOUND', 404);
    }

    const firstOrderRow = internalOrderRows.rows[0];
    if (['checked-in', 'occupied'].includes(firstOrderRow.status)) {
      throw createDouyinError('已入住订单不允许取消', 'DOUYIN_ORDER_CANCEL_FORBIDDEN', 409);
    }

    await orderModule.updateOrderStatus(douyinOrderRow.internal_order_id, 'cancelled', client);
    await client.query(
      `UPDATE douyin_order
          SET order_status = $1,
              cancel_status = $2,
              raw_cancel_payload = $3::jsonb,
              updated_at = now()
        WHERE id = $4`,
      ['cancelled', 'cancelled', JSON.stringify(payload), douyinOrderRow.id]
    );

    await insertOrderEvent(client, {
      douyin_order_id: douyinOrderRow.douyin_order_id,
      order_out_id: douyinOrderRow.order_out_id,
      internal_order_id: douyinOrderRow.internal_order_id,
      event_type: 'order_cancel',
      direction: 'inbound',
      idempotency_key: `douyin:cancel:${douyinOrderRow.douyin_order_id}`,
      request_payload: payload,
      response_payload: { cancelled: true }
    });

    await client.query('COMMIT');
    committed = true;
    return {
      cancelled: true,
      alreadyCancelled: false,
      data: {
        douyin_order_id: douyinOrderRow.douyin_order_id,
        order_out_id: douyinOrderRow.order_out_id,
        internal_order_id: douyinOrderRow.internal_order_id
      }
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
 * 获取抖音订单详情，供测试和内部调试使用。
 * @param {string} douyinOrderId 抖音订单号
 * @returns {Promise<object|null>} 抖音订单记录
 */
async function getDouyinOrderByDouyinId(douyinOrderId) {
  const result = await query(
    `SELECT * FROM douyin_order WHERE douyin_order_id = $1 LIMIT 1`,
    [douyinOrderId]
  );
  return result.rows[0] || null;
}

module.exports = {
  cancelDouyinOrder,
  createDouyinOrder,
  getDouyinOrderByDouyinId
};
