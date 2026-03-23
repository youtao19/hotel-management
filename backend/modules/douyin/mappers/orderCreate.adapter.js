const {
  generateOrderNumber,
  randomRoomNumber
} = require('../../tools')

function buildCreateOrderDataFromDouyin(douyinOrder) {

  const oderId = generateOrderNumber()

  const roomNum = randomRoomNumber(
    douyinOrder.room_type,
    douyinOrder.check_in_date,
    douyinOrder.check_out_date
  )

  return {
    orderId: douyinOrder.ota_order_id,   // 用抖音订单号
    sourceNumber: douyinOrder.ota_order_id,
    orderSource: 'douyin',

    guestName: douyinOrder.guest_name,
    phone: douyinOrder.guest_mobile,

    roomType: null,     // 后面可以做映射
    roomNumber: roomNum,   // OTA 不给

    checkInDate: douyinOrder.check_in_date,
    checkOutDate: douyinOrder.check_out_date,

    status: 'pending',  // 或你定义的“待确认”

    paymentMethod: '平台',

    roomPrice: buildDailyPrice(
      douyinOrder.check_in_date,
      douyinOrder.check_out_date,
      douyinOrder.amount
    ),

    deposit: 0,

    createTime: new Date(),

    remarks: '来自抖音OTA',

    isPrepaid: false,
    prepaidAmount: null,

    stayType: '客房',
  }
}

/**
 * 把总价拆成每天价格（简单均分版）
 */
function buildDailyPrice(checkIn, checkOut, totalAmount) {
  if (!checkIn || !checkOut) return {}

  const start = new Date(checkIn)
  const end = new Date(checkOut)

  const days = Math.max(
    Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
    1
  )

  const avg = Number(totalAmount || 0) / days

  const result = {}

  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)

    const key = d.toISOString().slice(0, 10)
    result[key] = Number(avg.toFixed(2))
  }

  return result
}

module.exports = {
  buildCreateOrderDataFromDouyin,
}
