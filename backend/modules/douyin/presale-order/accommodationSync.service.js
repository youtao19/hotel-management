"use strict";

const { douyinConfig } = require('../../../appSettings/douyin.config');
const douyinTokenService = require('../token/token.service');
const repository = require('./accommodationSync.repository');

const ACCOMMODATION_STATUS = Object.freeze({
  CHECKED_IN: 1,
  NO_SHOW: 2,
  CHECKED_OUT: 3
});
const AUDIT_NOTIFY_ENDPOINT = '/goodlife/v1/trip/trade/hotel/booking/audit/notify/';

/** 读取抖音响应中的排障 logid。 */
function getLogId(response) {
  return response?.extra?.logid || response?.extra?.log_id || null;
}

/** 读取抖音业务失败原因。 */
function getDouyinError(response, httpOk, httpStatus) {
  const errorCode = Number(response?.extra?.error_code ?? 0);
  const description = response?.extra?.sub_description || response?.extra?.description;
  if (!httpOk || errorCode !== 0) {
    return {
      errorCode: Number.isFinite(errorCode) && errorCode !== 0 ? errorCode : null,
      errorDescription: description || `抖音履约接口 HTTP ${httpStatus}`
    };
  }
  return null;
}

/** 构建预售券预约单履约状态通知请求。 */
function buildAccommodationPayload(booking, accommodationStatus) {
  return {
    order_id: booking.ota_order_id,
    order_out_id: booking.order_id,
    accommodation_status: accommodationStatus
  };
}

/** 向抖音同步一笔预售券预约单的履约状态。 */
async function syncAccommodationStatus(localOrderId, accommodationStatus, options = {}) {
  if (![ACCOMMODATION_STATUS.CHECKED_IN, ACCOMMODATION_STATUS.NO_SHOW, ACCOMMODATION_STATUS.CHECKED_OUT].includes(accommodationStatus)) {
    throw new Error('住宿状态不合法');
  }

  const booking = await repository.findBookingByLocalOrderId(localOrderId);
  if (!booking) return { eligible: false, reason: 'NOT_DOUYIN_PRESALE_BOOKING' };

  const existing = await repository.findSyncByBookingOrderId(booking.id, accommodationStatus);
  if (existing?.sync_status === 'SUCCEEDED') {
    return { eligible: true, duplicate: true, booking, sync: existing };
  }

  const sync = await repository.startSyncAttempt(booking.id, accommodationStatus);
  if (!sync) return { eligible: true, duplicate: true, booking, sync: await repository.findSyncByBookingOrderId(booking.id, accommodationStatus) };

  const fetchImpl = options.fetchImpl || global.fetch;
  const tokenService = options.tokenService || douyinTokenService;
  let response;
  let result;
  try {
    response = await fetchImpl(`${douyinConfig.openApiBaseUrl}${AUDIT_NOTIFY_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': await tokenService.getToken()
      },
      body: JSON.stringify(buildAccommodationPayload(booking, accommodationStatus))
    });
    result = await response.json();
  } catch (error) {
    const failed = await repository.markSyncFailed(sync.id, {
      errorDescription: `调用抖音履约接口失败: ${error.message}`
    });
    console.error('[Douyin Presale Accommodation] 调用失败:', {
      interface: AUDIT_NOTIFY_ENDPOINT,
      localOrderId,
      douyinOrderId: booking.ota_order_id,
      accommodationStatus,
      error: error.message
    });
    return { eligible: true, success: false, booking, sync: failed };
  }

  const logId = getLogId(result);
  const httpOk = response.ok === undefined
    ? response.status >= 200 && response.status < 300
    : response.ok;
  const douyinError = getDouyinError(result, httpOk, response.status);
  if (douyinError) {
    const failed = await repository.markSyncFailed(sync.id, { ...douyinError, logId, response: result });
    console.error('[Douyin Presale Accommodation] 抖音拒绝履约同步:', {
      interface: AUDIT_NOTIFY_ENDPOINT,
      localOrderId,
      douyinOrderId: booking.ota_order_id,
      accommodationStatus,
      douyinLogId: logId,
      errorCode: douyinError.errorCode,
      error: douyinError.errorDescription
    });
    return { eligible: true, success: false, booking, sync: failed };
  }

  const succeeded = await repository.markSyncSucceeded(sync.id, logId, result);
  console.log('[Douyin Presale Accommodation] 履约同步成功:', {
    interface: AUDIT_NOTIFY_ENDPOINT,
    localOrderId,
    douyinOrderId: booking.ota_order_id,
    accommodationStatus,
    douyinLogId: logId
  });
  return { eligible: true, success: true, booking, sync: succeeded };
}

/** 在本地订单事务提交后异步同步履约状态。 */
function scheduleAccommodationSync(localOrderId, accommodationStatus) {
  setImmediate(() => {
    syncAccommodationStatus(localOrderId, accommodationStatus).catch((error) => {
      console.error('[Douyin Presale Accommodation] 保存履约同步结果失败:', {
        interface: AUDIT_NOTIFY_ENDPOINT,
        localOrderId,
        accommodationStatus,
        error: error.message
      });
    });
  });
}

module.exports = {
  ACCOMMODATION_STATUS,
  AUDIT_NOTIFY_ENDPOINT,
  buildAccommodationPayload,
  getDouyinError,
  getLogId,
  scheduleAccommodationSync,
  syncAccommodationStatus
};
