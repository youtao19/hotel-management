const postgreDB = require('../../../database/postgreDB/pg')

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

async function createDouyinOrder(order) {
  const sql = `
    INSERT INTO douyin_orders (
      ota_order_id,
      account_id,
      order_status,
      guest_name,
      guest_mobile,
      check_in_date,
      check_out_date,
      room_count,
      amount,
      currency,
      raw_payload,
      mapped_payload
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12
    )
    RETURNING *
  `

  const values = [
    order.otaOrderId,
    order.accountId,
    order.orderStatus,
    order.guestName,
    order.guestMobile,
    order.checkInDate,
    order.checkOutDate,
    order.roomCount,
    order.amount,
    order.currency,
    JSON.stringify(order.rawPayload || {}),
    JSON.stringify(order.mappedPayload || {}),
  ]

  const result = await postgreDB.query(sql, values)
  return result.rows[0]
}

async function updateDouyinOrderByOtaOrderId(otaOrderId, order) {
  const sql = `
    UPDATE douyin_orders
    SET
      account_id = $2,
      order_status = $3,
      guest_name = $4,
      guest_mobile = $5,
      check_in_date = $6,
      check_out_date = $7,
      room_count = $8,
      amount = $9,
      currency = $10,
      raw_payload = $11,
      mapped_payload = $12,
      updated_at = NOW()
    WHERE ota_order_id = $1
    RETURNING *
  `

  const values = [
    otaOrderId,
    order.accountId,
    order.orderStatus,
    order.guestName,
    order.guestMobile,
    order.checkInDate,
    order.checkOutDate,
    order.roomCount,
    order.amount,
    order.currency,
    JSON.stringify(order.rawPayload || {}),
    JSON.stringify(order.mappedPayload || {}),
  ]

  const result = await postgreDB.query(sql, values)
  return result.rows[0] || null
}

module.exports = {
  findByOtaOrderId,
  createDouyinOrder,
  updateDouyinOrderByOtaOrderId,
}
