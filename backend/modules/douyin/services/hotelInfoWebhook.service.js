const { DOUYIN_SUCCESS_RESULT, DOUYIN_COMMON_ERROR } = require('../constants/errorCodes')
const { createDouyinBusinessError } = require('../utils/douyinError')

/**
 * 规范化酒店静态信息处理结果推送数据。
 *
 * @param {Object} payload 抖音推送原始请求体。
 * @returns {{accountId:string, hotelId:string, outHotelId:string, status:string, message:string, rawPayload:Object}} 规范化结果。
 */
function normalizeHotelInfoWebhookPayload(payload = {}) {
  return {
    accountId: String(payload.account_id || '').trim(),
    hotelId: String(payload.hotel_id || '').trim(),
    outHotelId: String(payload.out_hotel_id || '').trim(),
    status: String(payload.status || payload.hotel_status || payload.process_status || '').trim(),
    message: String(payload.description || payload.message || '').trim(),
    rawPayload: payload,
  }
}

/**
 * 处理抖音酒店静态信息处理结果推送。
 * 说明：
 * 1. 当前阶段先完成“可接收 + 可回执 success”；
 * 2. 推送原文先记录日志，后续可继续补落库与状态同步。
 *
 * @param {Object} payload 抖音推送原始请求体。
 * @param {{douyinLogId?:string}} [options] 处理选项。
 * @returns {{errorCode:number, description:string, action:string, normalizedPayload:Object}} 统一处理结果。
 */
async function handleDouyinHotelInfoWebhook(payload = {}, options = {}) {
  const normalizedPayload = normalizeHotelInfoWebhookPayload(payload)
  const douyinLogId = String(options.douyinLogId || '').trim()

  // 酒店静态信息推送最少应带 hotel_id 或 out_hotel_id，用于识别目标酒店。
  if (!normalizedPayload.hotelId && !normalizedPayload.outHotelId) {
    throw createDouyinBusinessError(
      DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
      'Missing hotel_id and out_hotel_id in hotel info webhook payload',
      '缺少酒店标识'
    )
  }

  console.info('[handleDouyinHotelInfoWebhook] payload accepted:', {
    douyinLogId,
    accountId: normalizedPayload.accountId,
    hotelId: normalizedPayload.hotelId,
    outHotelId: normalizedPayload.outHotelId,
    status: normalizedPayload.status,
    message: normalizedPayload.message,
  })

  return {
    errorCode: DOUYIN_SUCCESS_RESULT.code,
    description: DOUYIN_SUCCESS_RESULT.description,
    action: 'accepted',
    normalizedPayload,
  }
}

module.exports = {
  handleDouyinHotelInfoWebhook,
  normalizeHotelInfoWebhookPayload,
}
