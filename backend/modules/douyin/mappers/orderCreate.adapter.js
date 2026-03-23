const {
  generateOrderNumber,
  randomRoomNumber,
} = require('../../tools')

const {
  findLocalRoomTypeByDouyinRoomId,
} = require('../repositories/roomTypeMapping.repository')

async function buildCreateOrderDataFromDouyin(douyinOrder) {
  const orderId = generateOrderNumber()

  const localRoomType =
    await findLocalRoomTypeByDouyinRoomId(douyinOrder.room_id)

  if (!localRoomType) {
    throw new Error(`Douyin room type is not mapped: room_id=${douyinOrder.room_id}`)
  }

  const roomNum = await randomRoomNumber(
    localRoomType,
    douyinOrder.check_in_date,
    douyinOrder.check_out_date
  )

  if (!roomNum) {
    throw new Error(
      `No available room for roomType=${localRoomType}, checkIn=${douyinOrder.check_in_date}, checkOut=${douyinOrder.check_out_date}`
    )
  }

  return {
    orderId,
    sourceNumber: douyinOrder.ota_order_id,
    orderSource: 'douyin',

    guestName: douyinOrder.guest_name,
    phone: douyinOrder.guest_mobile,

    roomType: localRoomType,
    roomNumber: roomNum,

    checkInDate: douyinOrder.check_in_date,
    checkOutDate: douyinOrder.check_out_date,

    status: 'pending',

    paymentMethod: '平台',

    roomPrice: buildDailyPrice(
      douyinOrder.check_in_date,
      douyinOrder.check_out_date,
      douyinOrder.amount
    ),

    deposit: 0,

    createTime: new Date(),

    remarks: `来自抖音OTA，抖音订单号: ${douyinOrder.ota_order_id}`,

    isPrepaid: false,
    prepaidAmount: 0,

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
