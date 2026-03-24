const postgreDB = require('../../../database/postgreDB/pg')
const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const {
  DOUYIN_BOOKING_ERROR,
  DOUYIN_CANCEL_ERROR,
} = require('../constants/errorCodes')
const { createDouyinBusinessError } = require('../utils/douyinError')

const DOUYIN_ACCOMMODATION_STATUS = Object.freeze({
  CHECKED_IN: 1,
  CHECKED_OUT: 3,
})

const DOUYIN_FULFILLMENT_ACTION = Object.freeze({
  CHECK_IN: 'check_in',
  CHECK_OUT: 'check_out',
})

/**
 * 根据本地系统订单号查询抖音落地订单。
 *
 * @param {string} orderId 本地系统订单号。
 * @returns {Promise<Object|null>} 抖音落地订单。
 */
async function findDouyinOrderBySystemOrderId(orderId) {
  const result = await postgreDB.query(
    `SELECT *
     FROM douyin_orders
     WHERE system_order_id = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [orderId]
  )

  return result.rows[0] || null
}

/**
 * 判断本地系统订单是否存在抖音映射。
 *
 * @param {string} orderId 本地系统订单号。
 * @returns {Promise<boolean>} 是否为抖音订单。
 */
async function isDouyinSystemOrder(orderId) {
  const douyinOrder = await findDouyinOrderBySystemOrderId(orderId)
  return Boolean(douyinOrder)
}

/**
 * 构建抖音履约同步请求体。
 *
 * @param {Object} douyinOrder 抖音落地订单。
 * @param {'check_in'|'check_out'} actionType 同步动作。
 * @returns {{accommodation_status:number, order_id:string, order_out_id:string}} 请求体。
 */
function buildDouyinFulfillmentPayload(douyinOrder, actionType) {
  const otaOrderId = String(douyinOrder?.ota_order_id || '').trim()
  const systemOrderId = String(douyinOrder?.system_order_id || '').trim()

  if (!otaOrderId) {
    throw createDouyinBusinessError(DOUYIN_BOOKING_ERROR.MISSING_ORDER_ID, 'Missing ota_order_id in douyin order')
  }

  if (!systemOrderId) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.ORDER_NOT_FOUND, 'Missing system_order_id in douyin order')
  }

  return {
    accommodation_status: actionType === DOUYIN_FULFILLMENT_ACTION.CHECK_OUT
      ? DOUYIN_ACCOMMODATION_STATUS.CHECKED_OUT
      : DOUYIN_ACCOMMODATION_STATUS.CHECKED_IN,
    order_id: otaOrderId,
    order_out_id: systemOrderId,
  }
}

/**
 * 回写履约同步结果。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.orderId 本地系统订单号。
 * @param {'check_in'|'check_out'} params.actionType 同步动作。
 * @param {'sent'|'failed'} params.status 推送状态。
 * @param {Object} params.response 推送返回。
 * @returns {Promise<void>} 回写完成。
 */
async function saveDouyinFulfillmentResult({
  orderId,
  actionType,
  status,
  response,
}) {
  await postgreDB.query(
    `UPDATE douyin_orders
     SET fulfillment_status = $2,
         fulfillment_action = $3,
         fulfillment_response = $4,
         fulfillment_sent_at = NOW(),
         updated_at = NOW()
     WHERE system_order_id = $1`,
    [orderId, status, actionType, JSON.stringify(response || {})]
  )
}

/**
 * 推送抖音履约状态。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.orderId 本地系统订单号。
 * @param {'check_in'|'check_out'} params.actionType 同步动作。
 * @returns {Promise<Object>} 推送结果。
 */
async function pushDouyinFulfillment({
  orderId,
  actionType,
}) {
  const normalizedOrderId = String(orderId || '').trim()

  if (!normalizedOrderId) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.ORDER_NOT_FOUND, 'orderId is required')
  }

  const douyinOrder = await findDouyinOrderBySystemOrderId(normalizedOrderId)
  if (!douyinOrder) {
    throw createDouyinBusinessError(DOUYIN_CANCEL_ERROR.ORDER_NOT_FOUND, `Douyin order not found for orderId: ${normalizedOrderId}`)
  }

  const payload = buildDouyinFulfillmentPayload(douyinOrder, actionType)
  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/trade/hotel/booking/audit/notify/',
    withAccountId: false,
    data: payload,
  })

  const errorCode = result?.data?.error_code ?? result?.extra?.error_code ?? null
  const status = errorCode === 0 || errorCode === null ? 'sent' : 'failed'

  await saveDouyinFulfillmentResult({
    orderId: normalizedOrderId,
    actionType,
    status,
    response: result,
  })

  return {
    action: actionType,
    status,
    payload,
    result,
    douyinOrder,
  }
}

/**
 * 推送入住状态。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.orderId 本地系统订单号。
 * @returns {Promise<Object>} 推送结果。
 */
async function pushDouyinCheckIn({ orderId }) {
  return pushDouyinFulfillment({
    orderId,
    actionType: DOUYIN_FULFILLMENT_ACTION.CHECK_IN,
  })
}

/**
 * 推送离店状态。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.orderId 本地系统订单号。
 * @returns {Promise<Object>} 推送结果。
 */
async function pushDouyinCheckOut({ orderId }) {
  return pushDouyinFulfillment({
    orderId,
    actionType: DOUYIN_FULFILLMENT_ACTION.CHECK_OUT,
  })
}

/**
 * 按本地系统订单号推送入住状态。
 *
 * @param {string} orderId 本地系统订单号。
 * @returns {Promise<Object>} 推送结果。
 */
async function pushDouyinCheckInBySystemOrder(orderId) {
  return pushDouyinCheckIn({ orderId })
}

/**
 * 按本地系统订单号推送离店状态。
 *
 * @param {string} orderId 本地系统订单号。
 * @returns {Promise<Object>} 推送结果。
 */
async function pushDouyinCheckOutBySystemOrder(orderId) {
  return pushDouyinCheckOut({ orderId })
}

module.exports = {
  DOUYIN_ACCOMMODATION_STATUS,
  DOUYIN_FULFILLMENT_ACTION,
  buildDouyinFulfillmentPayload,
  findDouyinOrderBySystemOrderId,
  isDouyinSystemOrder,
  pushDouyinCheckIn,
  pushDouyinCheckInBySystemOrder,
  pushDouyinCheckOut,
  pushDouyinCheckOutBySystemOrder,
}
