/**
 * 按候选路径顺序从对象中提取第一个可用值。
 * 说明：
 * 1. 支持点号路径（如 "data.order_id"）进行多级取值；
 * 2. 按 paths 顺序依次尝试，命中即返回，不再继续；
 * 3. 当路径不存在或最终值为 undefined 时视为未命中；
 * 4. 全部路径未命中时返回 defaultValue。
 *
 * @param {Object} obj 需要读取的源对象。
 * @param {string[]} paths 候选字段路径列表，按优先级从高到低排列。
 * @param {*} [defaultValue=null] 未命中时的默认返回值。
 * @returns {*} 命中的字段值；若都未命中则返回 defaultValue。
 */
function pick(obj, paths, defaultValue = null) {
  for (const path of paths) {
    const keys = path.split('.')
    let current = obj

    let found = true
    for (const key of keys) {
      if (current == null || !(key in current)) {
        found = false
        break
      }
      current = current[key]
    }

    if (found && current !== undefined) {
      return current
    }
  }

  return defaultValue
}

function toNumber(value, defaultValue = null) {
  if (value === undefined || value === null || value === '') return defaultValue
  const num = Number(value)
  return Number.isNaN(num) ? defaultValue : num
}

function mapDouyinBookingPayload(payload = {}) {
  const otaOrderId = pick(payload, [
    'order_id',
    'data.order_id',
    'order.order_id',
  ])

  const accountId = pick(payload, [
    'account_id',
    'data.account_id',
    'poi_account_id',
  ])

  const orderStatus = pick(payload, [
    'order_status',
    'data.order_status',
    'status',
  ])

  const guestName = pick(payload, [
    'guest_name',
    'contact.name',
    'guest.name',
    'data.contact.name',
  ])

  const guestMobile = pick(payload, [
    'guest_mobile',
    'contact.mobile',
    'guest.mobile',
    'data.contact.mobile',
  ])

  const checkInDate = pick(payload, [
    'check_in_date',
    'arrival_date',
    'data.check_in_date',
  ])

  const checkOutDate = pick(payload, [
    'check_out_date',
    'departure_date',
    'data.check_out_date',
  ])

  const roomCount = toNumber(pick(payload, [
    'room_count',
    'data.room_count',
    'room_num',
  ]))

  const amount = toNumber(pick(payload, [
    'amount',
    'total_amount',
    'data.amount',
    'pay_amount',
  ]))

  const currency = pick(payload, [
    'currency',
    'data.currency',
  ], 'CNY')

  return {
    otaOrderId,
    accountId,
    orderStatus,
    guestName,
    guestMobile,
    checkInDate,
    checkOutDate,
    roomCount,
    amount,
    currency,
    rawPayload: payload,
  }
}

module.exports = {
  mapDouyinBookingPayload,
}
