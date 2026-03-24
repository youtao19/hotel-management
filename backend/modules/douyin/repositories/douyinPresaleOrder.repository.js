const postgreDB = require('../../../database/postgreDB/pg')

/**
 * 根据抖音预售订单号查询本地预售订单主记录。
 *
 * @param {string} otaOrderId 抖音预售订单号。
 * @returns {Promise<Object|null>} 查询结果；不存在时返回 null。
 */
async function findDouyinPresaleOrderByOtaOrderId(otaOrderId) {
  const result = await postgreDB.query(
    `SELECT *
       FROM douyin_presale_orders
      WHERE ota_order_id = $1
      LIMIT 1`,
    [otaOrderId]
  )

  return result.rows[0] || null
}

/**
 * 根据第三方订单号查询本地预售订单主记录。
 *
 * @param {string} orderId 第三方订单号。
 * @returns {Promise<Object|null>} 查询结果；不存在时返回 null。
 */
async function findDouyinPresaleOrderByOrderId(orderId) {
  const result = await postgreDB.query(
    `SELECT *
       FROM douyin_presale_orders
      WHERE order_id = $1
      LIMIT 1`,
    [orderId]
  )

  return result.rows[0] || null
}

/**
 * 创建本地预售订单主记录。
 *
 * @param {Object} order 预售订单数据。
 * @returns {Promise<Object>} 创建后的预售订单主记录。
 */
async function createDouyinPresaleOrder(order) {
  const result = await postgreDB.query(
    `INSERT INTO douyin_presale_orders (
        order_id,
        ota_order_id,
        source_order_id,
        account_id,
        hotel_id,
        biz_type,
        order_stage,
        pre_sale_coupon_id,
        goods_id,
        sku_id,
        rate_plan_id,
        contact_name,
        contact_mobile,
        guest_name,
        guest_mobile,
        voucher_count,
        each_coupon_amount,
        total_amount,
        currency,
        check_in_date,
        check_out_date,
        early_arrival_time,
        last_arrival_time,
        douyin_log_id,
        raw_payload,
        mapped_payload
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26
      )
      RETURNING *`,
    [
      order.orderId,
      order.otaOrderId,
      order.sourceOrderId,
      order.accountId,
      order.hotelId,
      order.bizType,
      order.orderStage,
      order.preSaleCouponId,
      order.goodsId,
      order.skuId,
      order.ratePlanId,
      order.contactName,
      order.contactMobileRaw || order.contactMobile,
      order.guestName,
      order.guestMobileRaw || order.guestMobile,
      order.voucherCount,
      order.eachCouponAmount,
      order.totalAmount,
      order.currency,
      order.checkInDate,
      order.checkOutDate,
      order.earlyArrivalTime,
      order.lastArrivalTime,
      order.douyinLogId || null,
      JSON.stringify(order.rawPayload || {}),
      JSON.stringify(order.mappedPayload || {}),
    ]
  )

  return result.rows[0]
}

/**
 * 按抖音预售订单号更新本地预售订单主记录。
 *
 * @param {string} otaOrderId 抖音预售订单号。
 * @param {Object} order 预售订单数据。
 * @returns {Promise<Object|null>} 更新后的预售订单主记录。
 */
async function updateDouyinPresaleOrderByOtaOrderId(otaOrderId, order) {
  const result = await postgreDB.query(
    `UPDATE douyin_presale_orders
        SET source_order_id = $2,
            account_id = $3,
            hotel_id = $4,
            biz_type = $5,
            order_stage = $6,
            pre_sale_coupon_id = $7,
            goods_id = $8,
            sku_id = $9,
            rate_plan_id = $10,
            contact_name = $11,
            contact_mobile = $12,
            guest_name = $13,
            guest_mobile = $14,
            voucher_count = $15,
            each_coupon_amount = $16,
            total_amount = $17,
            currency = $18,
            check_in_date = $19,
            check_out_date = $20,
            early_arrival_time = $21,
            last_arrival_time = $22,
            douyin_log_id = $23,
            raw_payload = $24,
            mapped_payload = $25,
            updated_at = NOW()
      WHERE ota_order_id = $1
      RETURNING *`,
    [
      otaOrderId,
      order.sourceOrderId,
      order.accountId,
      order.hotelId,
      order.bizType,
      order.orderStage,
      order.preSaleCouponId,
      order.goodsId,
      order.skuId,
      order.ratePlanId,
      order.contactName,
      order.contactMobileRaw || order.contactMobile,
      order.guestName,
      order.guestMobileRaw || order.guestMobile,
      order.voucherCount,
      order.eachCouponAmount,
      order.totalAmount,
      order.currency,
      order.checkInDate,
      order.checkOutDate,
      order.earlyArrivalTime,
      order.lastArrivalTime,
      order.douyinLogId || null,
      JSON.stringify(order.rawPayload || {}),
      JSON.stringify(order.mappedPayload || {}),
    ]
  )

  return result.rows[0] || null
}

/**
 * 将抖音落地订单与本地第三方订单号绑定。
 *
 * @param {string} otaOrderId 抖音预售订单号。
 * @param {string} orderOutId 第三方订单号。
 * @returns {Promise<Object|null>} 更新后的抖音落地订单。
 */
async function bindPresaleOrderOutIdToDouyinOrder(otaOrderId, orderOutId) {
  const result = await postgreDB.query(
    `UPDATE douyin_orders
        SET system_order_id = $2,
            updated_at = NOW()
      WHERE ota_order_id = $1
      RETURNING *`,
    [otaOrderId, orderOutId]
  )

  return result.rows[0] || null
}

module.exports = {
  findDouyinPresaleOrderByOtaOrderId,
  findDouyinPresaleOrderByOrderId,
  createDouyinPresaleOrder,
  updateDouyinPresaleOrderByOtaOrderId,
  bindPresaleOrderOutIdToDouyinOrder,
}
