const { mapDouyinBookingPayload } = require('../mappers/booking.mapper')
const {
  findByOtaOrderId,
  createDouyinOrder,
  updateDouyinOrderByOtaOrderId,
} = require('../repositories/douyinOrder.repository')

/**
 * 创建抖音创单业务异常。
 *
 * @param {number} code 抖音酒店交易错误码。
 * @param {string} description 错误描述。
 * @param {string} message 内部错误信息。
 * @returns {Error} 带有抖音错误码的异常对象。
 */
function createDouyinBookingError(code, description, message) {
  const error = new Error(message || description)
  error.douyinErrorCode = code
  error.douyinDescription = description
  return error
}

/**
 * 判断是否为 yyyy-MM-dd 格式日期。
 *
 * @param {*} value 原始日期值。
 * @returns {boolean} 合法时返回 true。
 */
function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * 验证抖音创单回调关键字段。
 *
 * @param {Object} mapped 映射后的抖音订单。
 * @returns {void}
 * @throws {Error} 字段不满足要求时抛出抖音业务异常。
 */
function validateDouyinBookingPayload(mapped) {
  if (!mapped.otaOrderId) {
    throw createDouyinBookingError(13, '缺少抖音订单号', 'Missing otaOrderId(order_id) in Douyin payload')
  }

  if (!mapped.hotelId) {
    throw createDouyinBookingError(13, '缺少抖音酒店ID', 'Missing hotelId in Douyin payload')
  }

  if (!mapped.roomId || !mapped.ratePlanId) {
    throw createDouyinBookingError(1, '房型不存在/失效', 'Missing roomId or ratePlanId in Douyin payload')
  }

  if (mapped.bizType === null || mapped.bizType === undefined) {
    throw createDouyinBookingError(13, '缺少业务类型', 'Missing bizType in Douyin payload')
  }

  if (!isValidDateString(mapped.checkInDate) || !isValidDateString(mapped.checkOutDate) || mapped.checkOutDate < mapped.checkInDate) {
    throw createDouyinBookingError(5, '日期格式错误', 'Invalid checkInDate/checkOutDate in Douyin payload')
  }

  if (!mapped.roomCount || mapped.roomCount <= 0) {
    throw createDouyinBookingError(13, '预定间数不合法', 'Invalid number_of_units in Douyin payload')
  }

  if (!mapped.numberOfGuests || mapped.numberOfGuests <= 0) {
    throw createDouyinBookingError(13, '入住人数不合法', 'Invalid number_of_guests in Douyin payload')
  }

  if (!mapped.amount || mapped.amount <= 0) {
    throw createDouyinBookingError(13, '订单金额不合法', 'Invalid total amount in Douyin payload')
  }

  if (!mapped.guestName) {
    throw createDouyinBookingError(6, '姓名/联系电话格式错', 'Missing guest name in Douyin payload')
  }
}

/**
 * 将内部异常映射为抖音酒店交易错误码。
 *
 * @param {Error} error 原始异常对象。
 * @returns {Error} 带有抖音错误码的异常对象。
 */
function normalizeDouyinBookingError(error) {
  if (error?.douyinErrorCode !== undefined) {
    return error
  }

  const message = String(error?.message || '')

  if (message.includes('Douyin room type is not mapped')) {
    return createDouyinBookingError(1, '房型不存在/失效', message)
  }

  if (message.includes('No available room')) {
    return createDouyinBookingError(4, '入住时期内已满', message)
  }

  if (message.includes('无效的日期格式') || message.includes('Invalid checkInDate/checkOutDate')) {
    return createDouyinBookingError(5, '日期格式错误', message)
  }

  if (message.includes('电话号码')) {
    return createDouyinBookingError(6, '姓名/联系电话格式错', message)
  }

  if (error?.code === '40001' || error?.code === '40P01') {
    return createDouyinBookingError(100, '需要重试', message || 'Database transaction should retry')
  }

  return createDouyinBookingError(13, '其他异常', message || 'Unknown douyin booking error')
}

/**
 * 处理抖音“酒店创建订单”回调落库。
 *
 * @param {Object} payload 抖音原始回调请求体。
 * @returns {Promise<{action:string, order:Object}>} 落库结果。
 * @throws {Error} 参数错误或业务处理失败时抛出带错误码的异常。
 */
async function handleDouyinHotelBooking(payload = {}) {
  try {
    const mapped = mapDouyinBookingPayload(payload)

    validateDouyinBookingPayload(mapped)

    const existingOrder = await findByOtaOrderId(mapped.otaOrderId)

    const orderToSave = {
      ...mapped,
      mappedPayload: mapped,
    }

    if (!existingOrder) {
      const created = await createDouyinOrder(orderToSave)

      return {
        action: 'created',
        order: created,
      }
    }

    const updated = await updateDouyinOrderByOtaOrderId(mapped.otaOrderId, orderToSave)

    return {
      action: 'updated',
      order: updated,
    }
  } catch (error) {
    throw normalizeDouyinBookingError(error)
  }
}

module.exports = {
  handleDouyinHotelBooking,
}
