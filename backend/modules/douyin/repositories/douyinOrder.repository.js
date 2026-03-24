const postgreDB = require('../../../database/postgreDB/pg')

/**
 * 根据抖音订单号查询落地订单。
 *
 * @param {string} otaOrderId 抖音订单号。
 * @returns {Promise<Object|null>} 查询到的抖音订单；不存在时返回 null。
 * @throws {Error} 数据库查询失败时抛出异常。
 */
async function findByOtaOrderId(otaOrderId) {
  const sql = `
    SELECT *
    FROM douyin_orders
    WHERE ota_order_id = $1
    LIMIT 1
  `
  const result = await postgreDB.query(sql, [otaOrderId])
  return result.rows[0] || null
}

/**
 * 新建抖音落地订单。
 *
 * @param {Object} order 抖音映射后的订单对象。
 * @returns {Promise<Object>} 创建后的抖音订单记录。
 * @throws {Error} 数据库写入失败时抛出异常。
 */
async function createDouyinOrder(order) {
  const sql = `
    INSERT INTO douyin_orders (
      ota_order_id,
      source_order_id,
      hotel_id,
      account_id,
      order_status,
      guest_name,
      guest_mobile,
      contact_name,
      contact_mobile,
      check_in_date,
      check_out_date,
      room_count,
      number_of_guests,
      amount,
      amount_before_tax,
      currency,
      room_id,
      room_name,
      rate_plan_id,
      biz_type,
      remark_from_douyin,
      remark_from_guest,
      daily_rates,
      occupancies,
      member_info,
      douyin_log_id,
      confirm_mode,
      raw_payload,
      mapped_payload
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17,
      $18, $19, $20, $21, $22, $23, $24, $25,
      $26, $27, $28, $29
    )
    RETURNING *
  `

  const values = [
    order.otaOrderId,
    order.sourceOrderId,
    order.hotelId,
    order.accountId,
    order.orderStatus,
    order.guestName,
    order.guestMobileRaw || order.guestMobile,
    order.contactName,
    order.contactMobileRaw || order.contactMobile,
    order.checkInDate,
    order.checkOutDate,
    order.roomCount,
    order.numberOfGuests,
    order.amount,
    order.amountBeforeTax,
    order.currency,
    order.roomId,
    order.roomName,
    order.ratePlanId,
    order.bizType,
    order.remarkFromDouyin,
    order.remarkFromGuest,
    JSON.stringify(order.dailyRates || []),
    JSON.stringify(order.occupancies || []),
    JSON.stringify(order.memberInfo || null),
    order.douyinLogId || null,
    order.confirmMode || null,
    JSON.stringify(order.rawPayload || {}),
    JSON.stringify(order.mappedPayload || {}),
  ]

  const result = await postgreDB.query(sql, values)
  return result.rows[0]
}

/**
 * 按抖音订单号更新落地订单。
 *
 * @param {string} otaOrderId 抖音订单号。
 * @param {Object} order 抖音映射后的订单对象。
 * @returns {Promise<Object|null>} 更新后的抖音订单记录。
 * @throws {Error} 数据库更新失败时抛出异常。
 */
async function updateDouyinOrderByOtaOrderId(otaOrderId, order) {
  const sql = `
    UPDATE douyin_orders
    SET
      source_order_id = $2,
      hotel_id = $3,
      account_id = $4,
      order_status = $5,
      guest_name = $6,
      guest_mobile = $7,
      contact_name = $8,
      contact_mobile = $9,
      check_in_date = $10,
      check_out_date = $11,
      room_count = $12,
      number_of_guests = $13,
      amount = $14,
      amount_before_tax = $15,
      currency = $16,
      room_id = $17,
      room_name = $18,
      rate_plan_id = $19,
      biz_type = $20,
      remark_from_douyin = $21,
      remark_from_guest = $22,
      daily_rates = $23,
      occupancies = $24,
      member_info = $25,
      douyin_log_id = $26,
      confirm_mode = $27,
      raw_payload = $28,
      mapped_payload = $29,
      updated_at = NOW()
    WHERE ota_order_id = $1
    RETURNING *
  `

  const values = [
    otaOrderId,
    order.sourceOrderId,
    order.hotelId,
    order.accountId,
    order.orderStatus,
    order.guestName,
    order.guestMobileRaw || order.guestMobile,
    order.contactName,
    order.contactMobileRaw || order.contactMobile,
    order.checkInDate,
    order.checkOutDate,
    order.roomCount,
    order.numberOfGuests,
    order.amount,
    order.amountBeforeTax,
    order.currency,
    order.roomId,
    order.roomName,
    order.ratePlanId,
    order.bizType,
    order.remarkFromDouyin,
    order.remarkFromGuest,
    JSON.stringify(order.dailyRates || []),
    JSON.stringify(order.occupancies || []),
    JSON.stringify(order.memberInfo || null),
    order.douyinLogId || null,
    order.confirmMode || null,
    JSON.stringify(order.rawPayload || {}),
    JSON.stringify(order.mappedPayload || {}),
  ]

  const result = await postgreDB.query(sql, values)
  return result.rows[0] || null
}

/**
 * 按抖音订单号写入或更新创单失败记录。
 *
 * @param {Object} order 失败订单对象。
 * @returns {Promise<Object|null>} 写入后的失败记录。
 */
async function upsertDouyinBookingFailure(order) {
  const otaOrderId = String(order?.otaOrderId || '').trim()
  if (!otaOrderId) {
    return null
  }

  const sql = `
    INSERT INTO douyin_orders (
      ota_order_id,
      source_order_id,
      hotel_id,
      account_id,
      order_status,
      check_in_date,
      check_out_date,
      room_id,
      room_name,
      rate_plan_id,
      biz_type,
      douyin_log_id,
      booking_stage,
      booking_error_code,
      booking_error_description,
      booking_failure_response,
      raw_payload,
      mapped_payload
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17, $18
    )
    ON CONFLICT (ota_order_id) DO UPDATE
    SET source_order_id = EXCLUDED.source_order_id,
        hotel_id = EXCLUDED.hotel_id,
        account_id = EXCLUDED.account_id,
        order_status = EXCLUDED.order_status,
        check_in_date = EXCLUDED.check_in_date,
        check_out_date = EXCLUDED.check_out_date,
        room_id = EXCLUDED.room_id,
        room_name = EXCLUDED.room_name,
        rate_plan_id = EXCLUDED.rate_plan_id,
        biz_type = EXCLUDED.biz_type,
        douyin_log_id = EXCLUDED.douyin_log_id,
        booking_stage = EXCLUDED.booking_stage,
        booking_error_code = EXCLUDED.booking_error_code,
        booking_error_description = EXCLUDED.booking_error_description,
        booking_failure_response = EXCLUDED.booking_failure_response,
        raw_payload = EXCLUDED.raw_payload,
        mapped_payload = EXCLUDED.mapped_payload,
        updated_at = NOW()
    RETURNING *
  `

  const values = [
    otaOrderId,
    order.sourceOrderId || null,
    order.hotelId || null,
    order.accountId || null,
    order.orderStatus || 'failed',
    order.checkInDate || null,
    order.checkOutDate || null,
    order.roomId || null,
    order.roomName || null,
    order.ratePlanId || null,
    order.bizType ?? null,
    order.douyinLogId || null,
    order.bookingStage || null,
    order.bookingErrorCode ?? null,
    order.bookingErrorDescription || null,
    JSON.stringify(order.bookingFailureResponse || {}),
    JSON.stringify(order.rawPayload || {}),
    JSON.stringify(order.mappedPayload || {}),
  ]

  const result = await postgreDB.query(sql, values)
  return result.rows[0] || null
}

module.exports = {
  findByOtaOrderId,
  createDouyinOrder,
  upsertDouyinBookingFailure,
  updateDouyinOrderByOtaOrderId,
}
