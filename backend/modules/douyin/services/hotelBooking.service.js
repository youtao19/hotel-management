const { mapDouyinBookingPayload } = require('../mappers/booking.mapper')
const {
  findByOtaOrderId,
  createDouyinOrder,
  updateDouyinOrderByOtaOrderId,
} = require('../repositories/douyinOrder.repository')
const {
  DOUYIN_COMMON_ERROR,
  DOUYIN_BOOKING_ERROR,
} = require('../constants/errorCodes')
const { createDouyinBusinessError } = require('../utils/douyinError')

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
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.MISSING_ORDER_ID, 'Missing otaOrderId(order_id) in Douyin payload')
  }

  if (!mapped.hotelId) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.MISSING_HOTEL_ID, 'Missing hotelId in Douyin payload')
  }

  if (!mapped.roomId || !mapped.ratePlanId) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, 'Missing roomId or ratePlanId in Douyin payload')
  }

  if (mapped.bizType === null || mapped.bizType === undefined) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.MISSING_BIZ_TYPE, 'Missing bizType in Douyin payload')
  }

  if (!isValidDateString(mapped.checkInDate) || !isValidDateString(mapped.checkOutDate) || mapped.checkOutDate < mapped.checkInDate) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_DATE, 'Invalid checkInDate/checkOutDate in Douyin payload')
  }

  if (!mapped.roomCount || mapped.roomCount <= 0) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_ROOM_COUNT, 'Invalid number_of_units in Douyin payload')
  }

  if (!mapped.numberOfGuests || mapped.numberOfGuests <= 0) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_GUEST_COUNT, 'Invalid number_of_guests in Douyin payload')
  }

  if (!mapped.amount || mapped.amount <= 0) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_AMOUNT, 'Invalid total amount in Douyin payload')
  }

  if (!mapped.guestName) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_CONTACT, 'Missing guest name in Douyin payload')
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
    return createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, message)
  }

  if (message.includes('No available room')) {
    return createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_FULL, message)
  }

  if (message.includes('无效的日期格式') || message.includes('Invalid checkInDate/checkOutDate')) {
    return createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_DATE, message)
  }

  if (message.includes('电话号码')) {
    return createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_CONTACT, message)
  }

  if (error?.code === '40001' || error?.code === '40P01') {
    return createDouyinBusinessError(DOUYIN_COMMON_ERROR.RETRY_LATER, message || 'Database transaction should retry')
  }

  return createDouyinBusinessError(DOUYIN_COMMON_ERROR.OTHER_EXCEPTION, message || 'Unknown douyin booking error')
}

/**
 * 处理抖音“酒店创建订单”回调落库。
 *
 * @param {Object} payload 抖音原始回调请求体。
 * @param {Object} [options={}] 附加处理参数。
 * @param {string} [options.douyinLogId=''] 抖音请求链路 logid。
 * @returns {Promise<{action:string, order:Object}>} 落库结果。
 * @throws {Error} 参数错误或业务处理失败时抛出带错误码的异常。
 */
async function handleDouyinHotelBooking(payload = {}, options = {}) {
  try {
    /** @type {string} 抖音请求链路 logid。 */
    const douyinLogId = String(options.douyinLogId || '').trim()
    const mapped = mapDouyinBookingPayload(payload)

    validateDouyinBookingPayload(mapped)

    const existingOrder = await findByOtaOrderId(mapped.otaOrderId)

    const orderToSave = {
      ...mapped,
      douyinLogId,
      mappedPayload: {
        ...mapped,
        douyinLogId,
      },
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
