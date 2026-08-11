"use strict";

const { getClient, query } = require('../../../database/postgreDB/pg');

const ACTIVE_ORDER_STATUSES = ['pending', 'reserved', 'checked-in', 'occupied'];

/** 查询抖音预约订单号对应的本地预约单。 */
async function findByDouyinOrderId(douyinOrderId, client) {
  const result = await client.query(
    `SELECT *
     FROM douyin_presale_booking_orders
     WHERE ota_order_id = $1
     LIMIT 1`,
    [douyinOrderId]
  );
  return result.rows[0] || null;
}

/** 查询本地预约订单，供异步确认接单使用。 */
async function findByLocalOrderId(localOrderId, client) {
  const queryRunner = client || { query };
  const result = await queryRunner.query(
    `SELECT *
     FROM douyin_presale_booking_orders
     WHERE order_id = $1
     LIMIT 1`,
    [localOrderId]
  );
  return result.rows[0] || null;
}

/** 查询预约已分配房间中维修、关闭或已不存在的房间。 */
async function findUnavailableAssignedRooms(assignedRooms) {
  const roomNumbers = Array.isArray(assignedRooms)
    ? [...new Set(assignedRooms.map((roomNumber) => String(roomNumber || '').trim()).filter(Boolean))]
    : [];
  if (!roomNumbers.length) {
    return [{ room_number: null, status: null, is_closed: null }];
  }

  const result = await query(
    `WITH assigned_rooms AS (
       SELECT DISTINCT unnest($1::text[]) AS room_number
     )
     SELECT assigned_rooms.room_number, rooms.status, rooms.is_closed
     FROM assigned_rooms
     LEFT JOIN rooms ON rooms.room_number = assigned_rooms.room_number
     WHERE rooms.room_number IS NULL
        OR rooms.is_closed = TRUE
        OR rooms.status = 'repair'
     ORDER BY assigned_rooms.room_number`,
    [roomNumbers]
  );
  return result.rows;
}

/** 标记预约退款完成，整单退款时释放该预约占用的本地房间库存。 */
async function markRefundCompleted(bookingOrder, logId, shouldReleaseInventory, client) {
  await client.query(
    `UPDATE douyin_presale_booking_orders
     SET booking_status = CASE WHEN $3 THEN 'REFUNDED' ELSE booking_status END,
         refund_status = 'COMPLETED',
         refund_log_id = $2,
         refund_received_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [bookingOrder.id, logId, shouldReleaseInventory]
  );
  if (!shouldReleaseInventory) return;

  // 部分退款不代表整笔预约已取消，不能释放整段库存。
  await client.query(
    `UPDATE orders
     SET status = 'cancelled'
     WHERE order_id = $1
       AND order_source = 'douyin_presale'
       AND status IN ('pending', 'reserved')`,
    [bookingOrder.order_id]
  );
}

/** 取消预约并释放尚未入住的本地占房。 */
async function markCancelled(bookingOrder, cancellation = {}, client) {
  await client.query(
    `UPDATE douyin_presale_booking_orders
     SET booking_status = 'CANCELLED',
         payment_status = CASE WHEN payment_status = 'PENDING' THEN 'CANCELLED' ELSE payment_status END,
         cancel_id = COALESCE($2, cancel_id),
         cancel_status = 'CANCELLED',
         cancel_log_id = COALESCE($3, cancel_log_id),
         cancel_payload = COALESCE($4::jsonb, cancel_payload),
         cancelled_at = NOW(),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND booking_status IN ('CREATED', 'CONFIRMED', 'CONFIRM_FAILED', 'CANCELLED')`,
    [bookingOrder.id, cancellation.cancelId || null, cancellation.logId || null, cancellation.rawPayload ? JSON.stringify(cancellation.rawPayload) : null]
  );
  await client.query(
    `UPDATE orders
     SET status = 'cancelled'
     WHERE order_id = $1
       AND order_source = 'douyin_presale'
       AND status IN ('pending', 'reserved')`,
    [bookingOrder.order_id]
  );
}

/** 查询已支付的预售券主订单，作为预约订单来源。 */
async function findPaidSourceOrder(sourceOrderId, client) {
  const result = await client.query(
    `SELECT id, order_id, ota_order_id, order_stage
     FROM douyin_presale_orders
     WHERE ota_order_id = $1
       AND biz_type = 2011
       AND order_stage = 'PAID'
     LIMIT 1`,
    [sourceOrderId]
  );
  return result.rows[0] || null;
}

/** 锁定入住区间内未被有效订单占用的本地房间。 */
async function lockAvailableRooms(client, roomTypeCode, checkInDate, checkOutDate, numberOfUnits) {
  const result = await client.query(
    `SELECT r.room_number
     FROM rooms r
     WHERE r.type_code = $1
       AND r.is_closed = FALSE
       AND r.status <> 'repair'
       AND NOT EXISTS (
         SELECT 1
         FROM orders o
         WHERE o.room_number = r.room_number
           AND o.status = ANY($4::text[])
           AND o.stay_date >= $2::date
           AND o.stay_date < $3::date
       )
     ORDER BY r.room_number
     LIMIT $5
     FOR UPDATE OF r SKIP LOCKED`,
    [roomTypeCode, checkInDate, checkOutDate, ACTIVE_ORDER_STATUSES, numberOfUnits]
  );
  return result.rows.map((row) => row.room_number);
}

/** 写入待异步确认的本地预约订单。 */
async function insertBooking(client, booking) {
  const result = await client.query(
    `INSERT INTO douyin_presale_booking_orders (
       order_id, ota_order_id, source_order_id, account_id,
       hotel_id, rate_plan_id, room_id, biz_type,
       booking_status, confirm_status, confirm_number, create_log_id,
       check_in_date, check_out_date, number_of_units, number_of_guests,
       total_amount, add_amount, payment_status, currency, assigned_rooms, daily_rates, occupancies,
       contact_info, raw_payload
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, 2012,
       'CREATED', 'PENDING', $8, $9,
       $10::date, $11::date, $12, $13,
       $14, $15, $16, $17, $18::jsonb, $19::jsonb, $20::jsonb,
       $21::jsonb, $22::jsonb
     ) RETURNING *`,
    [
      booking.localOrderId, booking.douyinOrderId, booking.sourceOrderId, booking.accountId || null,
      booking.hotelId, booking.ratePlanId, booking.roomId, booking.confirmNumber, booking.logId || null,
      booking.checkInDate, booking.checkOutDate, booking.numberOfUnits, booking.numberOfGuests,
      booking.totalAmount, booking.addAmount, booking.paymentStatus, booking.currency, JSON.stringify(booking.assignedRooms), JSON.stringify(booking.dailyRates), JSON.stringify(booking.occupancies),
      JSON.stringify(booking.contactInfo), JSON.stringify(booking.rawPayload)
    ]
  );
  return result.rows[0];
}

/** 记录预约加价支付成功，保留通知原文和抖音排障标识。 */
async function markPaid(bookingOrderId, paymentNotice, rawPayload, logId) {
  const result = await query(
    `UPDATE douyin_presale_booking_orders
     SET payment_status = 'PAID',
         payment_log_id = $2,
         raw_payload = jsonb_set(raw_payload, '{payment_notice}', $3::jsonb, true),
         updated_at = NOW()
     WHERE id = $1
       AND booking_status <> 'CANCELLED'
     RETURNING order_id, ota_order_id, payment_status`,
    [bookingOrderId, logId || null, JSON.stringify(rawPayload)]
  );
  return result.rows[0] || null;
}

/** 将预约对应的每间夜写入现有订单表以占用库存。 */
async function insertBookingOrderDays(client, booking) {
  for (const roomNumber of booking.assignedRooms) {
    for (const rate of booking.dailyRates) {
      await client.query(
        `INSERT INTO orders (
           order_id, id_source, order_source, guest_name, phone,
           room_type, room_number, check_in_date, check_out_date, stay_date,
           status, payment_method, total_price, is_prepaid, prepaid_amount,
           stay_type, remarks
         ) VALUES (
           $1, $2, 'douyin_presale', $3, $4,
           $5, $6, $7::date, $8::date, $9::date,
           'pending', '平台', $10, TRUE, 0,
           '客房', '抖音预售券预约'
         )`,
        [
          booking.localOrderId, booking.douyinOrderId, booking.guestName, booking.guestPhone || null,
          booking.roomTypeCode, roomNumber, booking.checkInDate, booking.checkOutDate, rate.periodStartDate,
          rate.originalAmount / 100
        ]
      );
    }
  }
}

/** 保存确认接单成功结果及抖音排障 logid。 */
async function markConfirmSucceeded(localOrderId, result) {
  await query(
    `UPDATE douyin_presale_booking_orders
     SET booking_status = 'CONFIRMED',
         confirm_status = 'CONFIRMED',
         confirm_log_id = $2,
         confirm_error = NULL,
         reject_code = NULL,
         reject_reason = NULL,
         confirm_response = $3::jsonb,
         confirmed_at = NOW(),
         updated_at = NOW()
     WHERE order_id = $1`,
    [localOrderId, result.logId || null, JSON.stringify(result.response)]
  );
}

/** 保存拒单成功结果及抖音排障 logid。 */
async function markConfirmRejected(localOrderId, result) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE douyin_presale_booking_orders
       SET booking_status = 'REJECTED',
           confirm_status = 'REJECTED',
           confirm_log_id = $2,
           confirm_error = NULL,
           reject_code = $3,
           reject_reason = $4,
           confirm_response = $5::jsonb,
           confirmed_at = NOW(),
           updated_at = NOW()
       WHERE order_id = $1`,
      [localOrderId, result.logId || null, result.rejectCode || null, result.rejectReason || null, JSON.stringify(result.response)]
    );

    // 拒单已在抖音侧成立，必须立即释放创建预约时占用的本地库存。
    await client.query(
      `UPDATE orders
       SET status = 'cancelled'
       WHERE order_id = $1
         AND order_source = 'douyin_presale'
         AND status IN ('pending', 'reserved')`,
      [localOrderId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** 保存确认接单失败结果，供重复回调或人工重试排查。 */
async function markConfirmFailed(localOrderId, result) {
  await query(
    `UPDATE douyin_presale_booking_orders
     SET booking_status = 'CONFIRM_FAILED',
         confirm_status = 'FAILED',
         confirm_log_id = $2,
         confirm_error = $3,
         reject_code = $5,
         reject_reason = $6,
         confirm_response = $4::jsonb,
         updated_at = NOW()
     WHERE order_id = $1`,
    [localOrderId, result.logId || null, result.errorMessage, JSON.stringify(result.response || {}), result.rejectCode || null, result.rejectReason || null]
  );
}

/** 返回运营人员可处理的抖音预约订单。 */
async function listBookings() {
  const result = await query(
    `SELECT order_id, ota_order_id, source_order_id, booking_status, confirm_status, payment_status, add_amount, cancel_status,
            reject_code, reject_reason, confirm_error, create_log_id, confirm_log_id,
            check_in_date::text AS check_in_date, check_out_date::text AS check_out_date,
            number_of_units, number_of_guests, assigned_rooms,
            to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
            to_char(confirmed_at, 'YYYY-MM-DD HH24:MI:SS') AS confirmed_at
     FROM douyin_presale_booking_orders
     ORDER BY created_at DESC`
  );
  return result.rows;
}

module.exports = {
  findByDouyinOrderId,
  findByLocalOrderId,
  findUnavailableAssignedRooms,
  findPaidSourceOrder,
  getClient,
  insertBooking,
  insertBookingOrderDays,
  lockAvailableRooms,
  markRefundCompleted,
  markCancelled,
  markPaid,
  markConfirmFailed,
  markConfirmRejected,
  markConfirmSucceeded,
  listBookings
};
