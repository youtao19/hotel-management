const postgreDB = require('../../../database/postgreDB/pg')
const { createOrder } = require('../../orderModule')
const { buildCreateOrderDataFromDouyin } = require('../mappers/orderCreate.adapter')

const {
  generateOrderNumber,
  randomRoomNumber
} = require('../../tools')


async function syncDouyinOrderToSystem(otaOrderId) {
  // 1️⃣ 查 douyin_orders
  const orderRes = await postgreDB.query(
    `SELECT * FROM douyin_orders WHERE ota_order_id = $1 LIMIT 1`,
    [otaOrderId]
  )

  const douyinOrder = orderRes.rows[0]

  if (!douyinOrder) {
    throw new Error('Douyin order not found')
  }

  // 2️⃣ 幂等：已经同步过就直接返回
  if (douyinOrder.synced) {
    return {
      action: 'skip',
      systemOrderId: douyinOrder.system_order_id,
    }
  }

  // 3️⃣ 转换成 createOrder 格式
  const orderData = buildCreateOrderDataFromDouyin(douyinOrder)

  // 4️⃣ 调你系统已有方法
  const insertRes = await createOrder(orderData)


  const systemOrderId = insertRes?.orderId;

  // 5 回写状态
  await postgreDB.query(
    `
    UPDATE douyin_orders
    SET synced = TRUE,
        system_order_id = $2
    WHERE ota_order_id = $1
    `,
    [otaOrderId, systemOrderId]
  )

  return {
    action: 'created',
    systemOrderId,
  }
}

module.exports = {
  syncDouyinOrderToSystem,
}
