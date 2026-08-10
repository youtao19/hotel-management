"use strict";

const { douyinConfig } = require('../../../appSettings/douyin.config');
const douyinTokenService = require('../token/token.service');
const repository = require('./bookingOrder.repository');

const CONFIRM_ENDPOINT = '/goodlife/v1/trip/trade/hotel/order/confirm/';

/** 从抖音响应中读取排障 logid。 */
function getLogId(response) {
  return response?.extra?.logid || response?.extra?.log_id || null;
}

/** 判断抖音 HTTP 200 响应中是否仍包含业务失败。 */
function getDouyinErrorMessage(response) {
  const code = Number(response?.extra?.error_code ?? response?.data?.error_code ?? 0);
  if (code === 0) return '';
  return response?.extra?.sub_description || response?.extra?.description || response?.data?.description || `抖音确认接单失败，error_code=${code}`;
}

/** 补充确认接单日志所需订单标识和抖音 logid。 */
function createConfirmError(message, booking, logId = null) {
  const error = new Error(message);
  error.douyinLogId = logId;
  error.douyinOrderId = booking.ota_order_id;
  error.confirmNumber = booking.confirm_number;
  return error;
}

/** 调用抖音确认接单接口，确认已创建的预约订单。 */
async function confirmBooking(localOrderId, options = {}) {
  const booking = await repository.findByLocalOrderId(localOrderId);
  if (!booking) {
    throw new Error(`预约订单不存在: ${localOrderId}`);
  }
  if (booking.confirm_status === 'CONFIRMED') {
    return { duplicate: true, logId: booking.confirm_log_id || null };
  }
  const accountId = douyinConfig.accountId;
  if (!accountId) {
    const errorMessage = '缺少抖音商家 account_id，请配置 DOUYIN_ACCOUNT_ID';
    await repository.markConfirmFailed(localOrderId, { errorMessage, logId: null, response: {} });
    throw createConfirmError(errorMessage, booking);
  }

  const payload = {
    order_id: booking.ota_order_id,
    confirm_result: {
      confirm_result: 1,
      confirm_number: booking.confirm_number
    }
  };
  let response;
  let result;
  try {
    response = await (options.fetchImpl || global.fetch)(`${douyinConfig.openApiBaseUrl}${CONFIRM_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': await douyinTokenService.getToken(),
        'Rpc-Transit-Life-Account': accountId
      },
      body: JSON.stringify(payload)
    });
    result = await response.json();
  } catch (error) {
    await repository.markConfirmFailed(localOrderId, { errorMessage: `调用确认接单接口失败: ${error.message}`, logId: null, response: {} });
    throw createConfirmError(`调用确认接单接口失败: ${error.message}`, booking);
  }

  const logId = getLogId(result);
  const errorMessage = !response.ok ? `确认接单接口 HTTP ${response.status}` : getDouyinErrorMessage(result);
  if (errorMessage) {
    await repository.markConfirmFailed(localOrderId, { errorMessage, logId, response: result });
    throw createConfirmError(errorMessage, booking, logId);
  }

  await repository.markConfirmSucceeded(localOrderId, { logId, response: result });
  console.log('[Douyin Presale Booking] 确认接单成功:', {
    interface: CONFIRM_ENDPOINT,
    douyinOrderId: booking.ota_order_id,
    localOrderId,
    confirmNumber: booking.confirm_number,
    confirmOrderLogId: logId
  });
  return { duplicate: false, logId };
}

/** 在创建预约响应返回后异步确认接单，不阻塞抖音 SPI。 */
function scheduleBookingConfirmation(localOrderId) {
  setImmediate(() => {
    confirmBooking(localOrderId).catch((error) => {
      console.error('[Douyin Presale Booking] 确认接单失败:', {
        interface: CONFIRM_ENDPOINT,
        douyinOrderId: error.douyinOrderId || null,
        localOrderId,
        confirmNumber: error.confirmNumber || null,
        confirmOrderLogId: error.douyinLogId || null,
        error: error.message
      });
    });
  });
}

module.exports = {
  CONFIRM_ENDPOINT,
  confirmBooking,
  createConfirmError,
  getDouyinErrorMessage,
  getLogId,
  scheduleBookingConfirmation
};
