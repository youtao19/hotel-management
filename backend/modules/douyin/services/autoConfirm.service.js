const { confirmDouyinOrder } = require('./confirmOrder.service')

async function autoConfirmOrder(douyinOrder) {
  // 先直接全部接单（测试用）
  return confirmDouyinOrder({
    otaOrderId: douyinOrder.ota_order_id,
    confirmNumber: `AUTO_${Date.now()}`
  })
}

module.exports = {
  autoConfirmOrder,
}
