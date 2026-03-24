const { generateOrderNumber } = require('../../tools')
const { mapDouyinPresaleBookingPayload } = require('../mappers/presaleBooking.mapper')
const {
  findByOtaOrderId,
  createDouyinOrder,
  updateDouyinOrderByOtaOrderId,
} = require('../repositories/douyinOrder.repository')
const {
  findDouyinPresaleOrderByOtaOrderId,
  createDouyinPresaleOrder,
  updateDouyinPresaleOrderByOtaOrderId,
  bindPresaleOrderOutIdToDouyinOrder,
} = require('../repositories/douyinPresaleOrder.repository')
const {
  DOUYIN_COMMON_ERROR,
  DOUYIN_BOOKING_ERROR,
  DOUYIN_PRESALE_ERROR,
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
 * 校验抖音预售券创单请求。
 *
 * @param {Object} mapped 映射后的预售订单数据。
 * @returns {void}
 */
function validateDouyinPresaleBookingPayload(mapped) {
  if (!mapped.otaOrderId) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.MISSING_ORDER_ID, 'Missing otaOrderId(order_id) in Douyin presale payload')
  }

  if (mapped.bizType !== 2011) {
    throw createDouyinBusinessError(DOUYIN_PRESALE_ERROR.INVALID_BIZ_TYPE, `Invalid bizType for presale payload: ${mapped.bizType}`)
  }

  if (!mapped.preSaleCouponId) {
    throw createDouyinBusinessError(DOUYIN_PRESALE_ERROR.MISSING_PRE_SALE_COUPON_ID, 'Missing pre_sale_coupon_id in Douyin presale payload')
  }

  if (!mapped.ratePlanId) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.ROOM_TYPE_INVALID, 'Missing rate_plan_id in Douyin presale payload')
  }

  if (!mapped.voucherCount || mapped.voucherCount <= 0) {
    throw createDouyinBusinessError(DOUYIN_PRESALE_ERROR.INVALID_VOUCHER_COUNT, 'Invalid voucher count in Douyin presale payload')
  }

  if (!mapped.totalAmount || mapped.totalAmount <= 0) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_AMOUNT, 'Invalid total amount in Douyin presale payload')
  }

  if (mapped.checkInDate && !isValidDateString(mapped.checkInDate)) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_DATE, 'Invalid check_in_date in Douyin presale payload')
  }

  if (mapped.checkOutDate && !isValidDateString(mapped.checkOutDate)) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.INVALID_DATE, 'Invalid check_out_date in Douyin presale payload')
  }
}

/**
 * 归一化预售券创单异常。
 *
 * @param {Error} error 原始异常。
 * @returns {Error} 抖音业务异常。
 */
function normalizeDouyinPresaleBookingError(error) {
  if (error?.douyinErrorCode !== undefined) {
    return error
  }

  const message = String(error?.message || '')

  if (error?.code === '40001' || error?.code === '40P01') {
    return createDouyinBusinessError(DOUYIN_COMMON_ERROR.RETRY_LATER, message || 'Database transaction should retry')
  }

  return createDouyinBusinessError(DOUYIN_COMMON_ERROR.OTHER_EXCEPTION, message || 'Unknown douyin presale booking error')
}

/**
 * 处理抖音住宿预售券创单 SPI。
 *
 * @param {Object} payload 抖音原始请求体。
 * @param {Object} [options={}] 附加处理参数。
 * @param {string} [options.douyinLogId=''] 抖音请求链路 logid。
 * @returns {Promise<{action:string, orderOutId:string, douyinOrder:Object, presaleOrder:Object}>} 处理结果。
 */
async function handleDouyinPresaleBooking(payload = {}, options = {}) {
  try {
    /** @type {string} 抖音请求链路 logid。 */
    const douyinLogId = String(options.douyinLogId || '').trim()
    /** @type {Object} 映射后的预售券订单数据。 */
    const mapped = mapDouyinPresaleBookingPayload(payload)

    validateDouyinPresaleBookingPayload(mapped)

    /** @type {Object|null} 已存在的抖音落地订单。 */
    const existingDouyinOrder = await findByOtaOrderId(mapped.otaOrderId)
    /** @type {Object|null} 已存在的本地预售订单主记录。 */
    const existingPresaleOrder = await findDouyinPresaleOrderByOtaOrderId(mapped.otaOrderId)
    /** @type {string} 本地第三方订单号。 */
    const orderOutId = existingPresaleOrder?.order_id || generateOrderNumber()

    /** @type {Object} 写入抖音落地订单的数据。 */
    const douyinOrderToSave = {
      ...mapped,
      douyinLogId,
      systemOrderId: orderOutId,
      mappedPayload: {
        ...mapped,
        douyinLogId,
        systemOrderId: orderOutId,
      },
    }

    /** @type {Object} 写入本地预售订单主表的数据。 */
    const presaleOrderToSave = {
      ...mapped,
      orderId: orderOutId,
      douyinLogId,
      mappedPayload: {
        ...mapped,
        orderId: orderOutId,
        douyinLogId,
      },
    }

    /** @type {Object} 抖音落地订单。 */
    const douyinOrder = existingDouyinOrder
      ? await updateDouyinOrderByOtaOrderId(mapped.otaOrderId, douyinOrderToSave)
      : await createDouyinOrder(douyinOrderToSave)

    /** @type {Object} 本地预售订单主记录。 */
    const presaleOrder = existingPresaleOrder
      ? await updateDouyinPresaleOrderByOtaOrderId(mapped.otaOrderId, presaleOrderToSave)
      : await createDouyinPresaleOrder(presaleOrderToSave)

    await bindPresaleOrderOutIdToDouyinOrder(mapped.otaOrderId, presaleOrder.order_id)

    return {
      action: existingPresaleOrder ? 'updated' : 'created',
      orderOutId: presaleOrder.order_id,
      douyinOrder: {
        ...douyinOrder,
        system_order_id: presaleOrder.order_id,
      },
      presaleOrder,
    }
  } catch (error) {
    throw normalizeDouyinPresaleBookingError(error)
  }
}

module.exports = {
  handleDouyinPresaleBooking,
}
