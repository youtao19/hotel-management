"use strict";

const express = require('express');
const redisDb = require('../../../database/redis/redis');
const signatureService = require('./signature.service');
const webhookService = require('./webhook.service');
const priceVolumeService = require('../availability/priceVolume.service');
const bookableCheckService = require('../availability/bookableCheck.service');
const presaleOrderService = require('../presale-order/presaleOrder.service');
const bookingOrderService = require('../presale-order/bookingOrder.service');
const bookingConfirmService = require('../presale-order/bookingConfirm.service');
const douyinSettingsService = require('../settings/douyinSettings.service');
const { douyinConfig } = require('../../../appSettings/douyin.config');
const paymentNoticeService = require('../presale-order/paymentNotice.service');
const cancelOrderService = require('../presale-order/cancelOrder.service');
const cancelAuditService = require('../presale-order/cancelAudit.service');
const refundResultService = require('../presale-order/refundResult.service');
const callbackLogService = require('./callbackLog.service');
const systemNotificationService = require('../../system-notification/systemNotification.service');

function successResponse() {
  return {
    data: {
      error_code: 0,
      description: 'success'
    }
  };
}

function getHeader(req, name) {
  return req.get(name) || '';
}

function summarizePriceVolumeRequest(payload = {}) {
  const dateRange = payload.date_range || {};

  return {
    ratePlanIds: payload.rate_plan_ids || payload.rate_plan_id || payload.ratePlanIds || [],
    hotelIds: payload.hotel_ids || payload.hotel_id || payload.hotelIds || [],
    dateRange: {
      start: dateRange.start || payload.start_date || payload.startDate || payload.check_in_date || payload.checkInDate || '',
      end: dateRange.end || payload.end_date || payload.endDate || payload.check_out_date || payload.checkOutDate || ''
    }
  };
}

function summarizeBookableRequest(payload = {}) {
  return {
    ratePlanId: payload.rate_plan_id || payload.ratePlanId || '',
    bizType: payload.biz_type || payload.bizType || '',
    checkInDate: payload.check_in_date || payload.checkInDate || '',
    checkOutDate: payload.check_out_date || payload.checkOutDate || '',
    numberOfUnits: payload.number_of_units || payload.numberOfUnits || '',
    totalAmount: payload.total_amount || payload.totalAmount || ''
  };
}

/** 提取预售创单排障所需字段，避免记录联系人隐私数据。 */
function summarizePresaleOrderRequest(payload = {}) {
  const contact = payload.contact_info || {};
  const encryptedPhone = String(contact.phone || contact.mobile || contact.phone_number || '').trim();
  return {
    douyinOrderId: payload.order_id || '',
    voucherId: payload.pre_sale_coupon_id || '',
    ratePlanId: payload.rate_plan_id || '',
    voucherCount: payload.total_coupon_count || '',
    totalAmount: payload.total_amount || '',
    contactPhoneMode: !encryptedPhone
      ? 'MISSING'
      : encryptedPhone.startsWith('Enc.')
        ? 'ONLINE_ENC'
        : 'LOCAL_OR_PLAIN'
  };
}

/** 提取预售券支付通知的排障字段，避免记录客人备注等信息。 */
function summarizePresalePaymentNotice(payload = {}) {
  return {
    douyinOrderId: payload.order_id || '',
    localOrderId: payload.order_out_id || '',
    bizType: payload.biz_type || '',
    payTimeUnix: payload.pay_time_unix || '',
    payAmount: payload.pay_amount || ''
  };
}

/** 提取创建预约排障字段，不把联系人和入住人信息写入运行日志。 */
function summarizePresaleBookingRequest(payload = {}) {
  return {
    douyinOrderId: payload.order_id || '',
    sourceOrderId: payload.source_order_id || '',
    ratePlanId: payload.rate_plan_id || '',
    roomId: payload.room_id || '',
    bizType: payload.biz_type || '',
    checkInDate: payload.check_in_date || '',
    checkOutDate: payload.check_out_date || '',
    numberOfUnits: payload.number_of_units || '',
    totalAmount: payload.total_amount || ''
  };
}

/** 提取预售券退款结果排障字段，避免记录退款原因和间夜明细。 */
function summarizePresaleRefundResult(payload = {}) {
  return {
    douyinOrderId: payload.order_id || '',
    localOrderId: payload.order_out_id || '',
    bizType: payload.biz_type || '',
    refundType: payload.refund_type || '',
    refundAmount: payload.refund_amount ?? '',
    userRefundAmount: payload.user_refund_amount ?? ''
  };
}

/** 提取取消 SPI 的排障字段，避免把退款明细写入运行日志。 */
function summarizeCancelOrderRequest(payload = {}) {
  return {
    douyinOrderId: payload.order_id || '',
    localOrderId: payload.order_out_id || '',
    cancelId: payload.cancel_id || '',
    bizType: payload.biz_type || '',
    cancelType: payload.cancel_type || '',
    afterSaleType: payload.after_sale_type || ''
  };
}

async function saveCallbackLog(record) {
  try {
    await callbackLogService.appendLog(record);
  } catch (error) {
    // 本地排障日志不能影响抖音回调响应，否则会把可恢复的文件写入问题放大成接口失败。
    console.warn('[Douyin Callback Log] 本地保存失败:', error.message);
  }
}

async function getRedisClient(redisProvider) {
  if (redisProvider?.getClient) {
    return redisProvider.getClient();
  }

  if (redisProvider?.initialize) {
    return await redisProvider.initialize();
  }

  throw new Error('Redis provider is not configured');
}

function createDouyinExternalRouter(options = {}) {
  const router = express.Router();
  const redisProvider = options.redisProvider || redisDb;
  const scheduleBookingConfirmation = options.scheduleBookingConfirmation || bookingConfirmService.scheduleBookingConfirmation;
  const autoConfirmEnabled = options.autoConfirmEnabled;

  router.post('/webhooks', async (req, res) => {
    const headerLogId = getHeader(req, 'x-bytedance-logid');
    let webhookLogId = headerLogId;

    try {
      if (!signatureService.verifyWebhookSignature(req)) {
        await saveCallbackLog({
          type: 'webhook',
          stage: 'signature_failed',
          logId: headerLogId,
          msgId: getHeader(req, 'Msg-Id')
        });
        return res.status(401).json({ message: '抖音 Webhook 签名校验失败' });
      }

      const payload = webhookService.parseWebhookPayload(req.body);
      const logId = headerLogId || payload.logId;
      webhookLogId = logId;
      if (payload.event === 'verify_webhook') {
        await saveCallbackLog({
          type: 'webhook',
          stage: 'verify_webhook',
          logId,
          event: payload.event
        });
        return res.status(200).json({
          challenge: payload.content.challenge
        });
      }

      const msgId = getHeader(req, 'Msg-Id');
      if (!msgId) {
        return res.status(400).json({ message: '缺少 Msg-Id，无法进行 Webhook 幂等去重' });
      }

      if (payload.event === systemNotificationService.AUDIT_EVENT) {
        // 审核通知以数据库唯一键去重，避免 Redis 过期后抖音重复投递再次产生铃铛提醒。
        const notification = await systemNotificationService.recordDouyinPresaleAuditNotification(msgId, payload);
        await saveCallbackLog({
          type: 'presale_audit_result',
          stage: notification.created ? 'processed' : 'duplicate',
          logId,
          event: payload.event,
          msgId,
          voucherId: notification.voucherId,
          auditResult: notification.auditResult
        });
        return res.status(200).json(successResponse());
      }

      const redisClient = await getRedisClient(redisProvider);
      const idempotency = await webhookService.markMessageProcessed(redisClient, msgId);
      if (idempotency.duplicate) {
        console.log('[Douyin Webhook] 重复消息已跳过:', {
          msgId,
          event: payload.event,
          logId: payload.logId
        });
        await saveCallbackLog({
          type: 'webhook',
          stage: 'duplicate',
          logId,
          event: payload.event,
          msgId
        });
        return res.status(200).json(successResponse());
      }

      console.log('[Douyin Webhook] 已接收消息:', webhookService.buildWebhookLog(payload, {
        msgId,
        logId
      }));
      await saveCallbackLog({
        type: 'webhook',
        stage: 'processed',
        logId,
        event: payload.event,
        msgId,
        contentAction: payload.content?.action || ''
      });

      return res.status(200).json(successResponse());
    } catch (error) {
      const statusCode = Number(error.statusCode || error.status || 500);
      console.error('[Douyin Webhook] 处理失败:', error);
      await saveCallbackLog({
        type: 'webhook',
        stage: 'error',
        logId: webhookLogId,
        statusCode,
        error: error.message
      });
      return res.status(statusCode).json({
        message: statusCode >= 500 ? '服务器错误' : error.message,
        error: error.message
      });
    }
  });

  router.post('/spi/price-volume', async (req, res) => {
    const logId = getHeader(req, 'x-bytedance-logid');

    try {
      if (!signatureService.verifySpiSignature(req)) {
        console.warn('[Douyin SPI] 签名校验失败:', { logId });
        await saveCallbackLog({
          type: 'spi_price_volume',
          stage: 'signature_failed',
          logId,
          ...summarizePriceVolumeRequest(req.body || {})
        });
        return res.status(401).json({ message: '抖音 SPI 签名校验失败' });
      }

      const data = await priceVolumeService.buildPriceVolumeResponse(req.body || {});
      const requestSummary = summarizePriceVolumeRequest(req.body || {});
      console.log('[Douyin SPI] 已处理价量态拉取:', {
        logId,
        ...requestSummary,
        errorCode: data.error_code,
        status: data.status,
        roomRateCount: Array.isArray(data.room_rates) ? data.room_rates.length : 0
      });
      await saveCallbackLog({
        type: 'spi_price_volume',
        stage: 'processed',
        logId,
        ...requestSummary,
        response: {
          errorCode: data.error_code,
          status: data.status,
          description: data.description,
          roomRateCount: Array.isArray(data.room_rates) ? data.room_rates.length : 0
        }
      });

      return res.status(200).json({ data });
    } catch (error) {
      console.error('[Douyin SPI] 价量态拉取处理失败:', {
        logId,
        error
      });
      await saveCallbackLog({
        type: 'spi_price_volume',
        stage: 'error',
        logId,
        ...summarizePriceVolumeRequest(req.body || {}),
        error: error.message
      });
      return res.status(500).json({
        data: {
          error_code: 13,
          status: false,
          description: '服务器错误',
          room_rates: [],
          timestamp: String(Math.floor(Date.now() / 1000))
        }
      });
    }
  });

  router.post('/spi/bookable', async (req, res) => {
    const logId = getHeader(req, 'x-bytedance-logid');

    try {
      // 可订检查是 SPI，不是 Webhook；这里必须使用 x-life-sign，否则抖音验收会直接失败。
      if (!signatureService.verifySpiSignature(req)) {
        console.warn('[Douyin SPI] 可订检查签名校验失败:', { logId });
        await saveCallbackLog({
          type: 'spi_bookable',
          stage: 'signature_failed',
          logId,
          ...summarizeBookableRequest(req.body || {})
        });
        return res.status(401).json({ message: '抖音 SPI 签名校验失败' });
      }

      const data = await bookableCheckService.buildBookableCheckResponse(req.body || {});
      const requestSummary = summarizeBookableRequest(req.body || {});
      // 记录 stock_and_amount 数量即可定位失败分支，避免把完整价量明细刷进运行日志。
      console.log('[Douyin SPI] 已处理预售券可订检查:', {
        logId,
        ...requestSummary,
        errorCode: data.error_code,
        stockAndAmountCount: Array.isArray(data.ari?.stock_and_amount) ? data.ari.stock_and_amount.length : 0
      });
      await saveCallbackLog({
        type: 'spi_bookable',
        stage: 'processed',
        logId,
        ...requestSummary,
        response: {
          errorCode: data.error_code,
          description: data.description,
          stockAndAmountCount: Array.isArray(data.ari?.stock_and_amount) ? data.ari.stock_and_amount.length : 0
        }
      });

      return res.status(200).json({ data });
    } catch (error) {
      console.error('[Douyin SPI] 预售券可订检查处理失败:', {
        logId,
        error
      });
      await saveCallbackLog({
        type: 'spi_bookable',
        stage: 'error',
        logId,
        ...summarizeBookableRequest(req.body || {}),
        error: error.message
      });
      return res.status(500).json({
        data: {
          error_code: 13,
          description: '服务器错误'
        }
      });
    }
  });

  /** 接收抖音预售券交易正向的创建订单请求。 */
  router.post('/spi/presale-order/create', async (req, res) => {
    const logId = getHeader(req, 'x-bytedance-logid');
    const summary = summarizePresaleOrderRequest(req.body || {});
    try {
      if (!signatureService.verifySpiSignature(req)) {
        console.warn('[Douyin SPI] 预售创单签名校验失败:', { logId, ...summary });
        await saveCallbackLog({ type: 'spi_presale_order_create', stage: 'signature_failed', logId, ...summary });
        return res.status(401).json({ message: '抖音 SPI 签名校验失败' });
      }
      const result = await presaleOrderService.createOrder(req.body || {}, {
        logId,
        accountId: getHeader(req, 'x-life-clientkey')
      });
      console.log('[Douyin SPI] 预售订单已创建:', { logId, ...summary, localOrderId: result.localOrderId, duplicate: result.duplicate });
      await saveCallbackLog({ type: 'spi_presale_order_create', stage: result.duplicate ? 'duplicate' : 'processed', logId, ...summary, localOrderId: result.localOrderId });
      return res.status(200).json({
        data: { error_code: 0, description: 'success', order_id: result.douyinOrderId, order_out_id: result.localOrderId }
      });
    } catch (error) {
      const errorCode = Number(error.douyinErrorCode) || 13;
      console.error('[Douyin SPI] 预售创单失败:', { logId, ...summary, errorCode, error: error.message });
      await saveCallbackLog({ type: 'spi_presale_order_create', stage: 'error', logId, ...summary, errorCode, error: error.message });
      return res.status(200).json({
        data: { error_code: errorCode, description: error.message, order_id: summary.douyinOrderId }
      });
    }
  });

  /** 接收抖音预售券预约单创建请求，并按异步接单模式返回。 */
  router.post('/spi/presale-order/booking', async (req, res) => {
    const logId = getHeader(req, 'x-bytedance-logid');
    const summary = summarizePresaleBookingRequest(req.body || {});
    try {
      if (!signatureService.verifySpiSignature(req)) {
        console.warn('[Douyin SPI] 预售预约创单签名校验失败:', { logId, ...summary });
        await saveCallbackLog({ type: 'spi_presale_booking_create', stage: 'signature_failed', logId, ...summary });
        return res.status(401).json({ message: '抖音 SPI 签名校验失败' });
      }
      const result = await bookingOrderService.createBooking(req.body || {}, {
        logId,
        accountId: getHeader(req, 'x-life-clientkey')
      });
      const shouldAutoConfirm = typeof autoConfirmEnabled === 'boolean'
        ? autoConfirmEnabled
        : await douyinSettingsService.isAutoConfirmEnabled();
      console.log('[Douyin SPI] 预售预约订单已创建，等待确认接单:', {
        logId,
        ...summary,
        localOrderId: result.localOrderId,
        duplicate: result.duplicate
      });
      await saveCallbackLog({
        type: 'spi_presale_booking_create',
        stage: result.duplicate ? 'duplicate' : 'processed',
        logId,
        ...summary,
        localOrderId: result.localOrderId
      });
      res.status(200).json({
        data: {
          error_code: 0,
          description: 'success',
          order_id: result.douyinOrderId,
          order_out_id: result.localOrderId,
          confirm_info: {
            hotel_confirm_number: result.confirmNumber,
            confirm_mode: 2
          }
        }
      });

      // 响应成功后再确认接单，抖音才能将预约单保持在待接单状态。
      if (result.needsConfirmation) {
        if (shouldAutoConfirm) {
          scheduleBookingConfirmation(result.localOrderId);
        } else {
          console.warn('[Douyin Presale Booking] 已跳过确认接单（超时联调）:', {
            logId,
            douyinOrderId: result.douyinOrderId,
            localOrderId: result.localOrderId,
            confirmNumber: result.confirmNumber
          });
          await saveCallbackLog({
            type: 'spi_presale_booking_create',
            stage: 'confirm_skipped_for_timeout_test',
            logId,
            ...summary,
            localOrderId: result.localOrderId
          });
        }
      }
    } catch (error) {
      const errorCode = Number(error.douyinErrorCode) || 13;
      console.error('[Douyin SPI] 预售预约创单失败:', { logId, ...summary, errorCode, error: error.message });
      await saveCallbackLog({ type: 'spi_presale_booking_create', stage: 'error', logId, ...summary, errorCode, error: error.message });
      return res.status(200).json({
        data: { error_code: errorCode, description: error.message, order_id: summary.douyinOrderId }
      });
    }
  });

  /** 接收抖音预售券交易正向的支付成功通知。 */
  router.post('/spi/presale-order/payment-notice', async (req, res) => {
    const logId = getHeader(req, 'x-bytedance-logid');
    const summary = summarizePresalePaymentNotice(req.body || {});
    try {
      if (!signatureService.verifySpiSignature(req)) {
        console.warn('[Douyin SPI] 预售支付通知签名校验失败:', { logId, ...summary });
        await saveCallbackLog({ type: 'spi_presale_payment_notice', stage: 'signature_failed', logId, ...summary });
        return res.status(401).json({ message: '抖音 SPI 签名校验失败' });
      }
      const result = await paymentNoticeService.recordPaymentNotice(req.body || {}, { logId });
      console.log('[Douyin SPI] 已接收预售支付通知:', { logId, ...summary, orderFound: result.orderFound, duplicate: result.duplicate });
      await saveCallbackLog({
        type: 'spi_presale_payment_notice',
        stage: result.orderFound ? (result.duplicate ? 'duplicate' : 'processed') : 'order_not_found',
        logId,
        ...summary
      });
      return res.status(200).json(successResponse());
    } catch (error) {
      const errorCode = Number(error.douyinErrorCode) || 13;
      console.error('[Douyin SPI] 预售支付通知处理失败:', { logId, ...summary, errorCode, error: error.message });
      await saveCallbackLog({ type: 'spi_presale_payment_notice', stage: 'error', logId, ...summary, errorCode, error: error.message });
      return res.status(200).json({ data: { error_code: errorCode, description: error.message } });
    }
  });

  /** 接收抖音预售券退款完成后的结果通知。 */
  router.post('/spi/presale-order/refund-result', async (req, res) => {
    const logId = getHeader(req, 'x-bytedance-logid');
    const summary = summarizePresaleRefundResult(req.body || {});
    try {
      if (!signatureService.verifySpiSignature(req)) {
        console.warn('[Douyin SPI] 预售券退款结果签名校验失败:', { logId, ...summary });
        await saveCallbackLog({ type: 'spi_presale_refund_result', stage: 'signature_failed', logId, ...summary });
        return res.status(401).json({ message: '抖音 SPI 签名校验失败' });
      }

      const result = await refundResultService.recordRefundResult(req.body || {}, { logId });
      console.log('[Douyin SPI] 已接收预售券退款结果:', {
        logId,
        ...summary,
        orderFound: result.orderFound,
        duplicate: result.duplicate,
        matchStatus: result.matchStatus
      });
      await saveCallbackLog({
        type: 'spi_presale_refund_result',
        stage: result.duplicate ? 'duplicate' : result.matchStatus.toLowerCase(),
        logId,
        ...summary
      });
    } catch (error) {
      // 退款已经由抖音完成，通知处理异常不能反向影响退款结果或触发无意义重试。
      console.error('[Douyin SPI] 预售券退款结果处理失败:', { logId, ...summary, error: error.message });
      await saveCallbackLog({ type: 'spi_presale_refund_result', stage: 'error', logId, ...summary, error: error.message });
    }

    return res.status(200).json(successResponse());
  });

  /** 接收抖音预售券交易逆向的取消订单请求。 */
  router.post('/spi/order/cancel', async (req, res) => {
    const logId = getHeader(req, 'x-bytedance-logid');
    const summary = summarizeCancelOrderRequest(req.body || {});
    try {
      if (!signatureService.verifySpiSignature(req)) {
        console.warn('[Douyin SPI] 取消订单签名校验失败:', { logId, ...summary });
        await saveCallbackLog({ type: 'spi_order_cancel', stage: 'signature_failed', logId, ...summary });
        return res.status(401).json({ message: '抖音 SPI 签名校验失败' });
      }

      // 平台明确要求审核时，先入库等待员工决定，不能在 SPI 内直接同意或拒绝。
      if (req.body?.need_audit === true) {
        const result = await cancelAuditService.receiveCancelAudit(req.body || {}, { logId });
        console.log('[Douyin SPI] 已接收待人工审核的取消申请:', { logId, ...summary, duplicate: result.duplicate });
        await saveCallbackLog({
          type: 'spi_order_cancel',
          stage: result.duplicate ? 'audit_duplicate' : 'audit_pending',
          logId,
          ...summary
        });
        return res.status(200).json({
          data: { error_code: 0, description: 'success', cancel_mode: 2 }
        });
      }

      // 订单类型由抖音回调决定；当前仅实现预售券取消，其他类型不能伪造成功。
      if (Number(req.body?.biz_type) !== 2011) {
        await saveCallbackLog({ type: 'spi_order_cancel', stage: 'biz_type_not_supported', logId, ...summary });
        return res.status(200).json({
          data: {
            error_code: 0,
            description: 'success',
            cancel_mode: 1,
            cancel_result: 2,
            reason: `暂未实现 biz_type=${summary.bizType} 的取消订单`
          }
        });
      }

      const result = await cancelOrderService.cancelOrder(req.body || {}, { logId });
      console.log('[Douyin SPI] 预售券取消订单已处理:', { logId, ...summary, ...result });
      await saveCallbackLog({
        type: 'spi_order_cancel',
        stage: result.duplicate ? 'duplicate' : 'processed',
        logId,
        ...summary,
        cancelResult: result.cancelResult,
        orderFound: result.orderFound
      });
      return res.status(200).json({
        data: { error_code: 0, description: 'success', cancel_mode: 1, cancel_result: result.cancelResult, reason: result.reason }
      });
    } catch (error) {
      const errorCode = Number(error.douyinErrorCode) || 13;
      console.error('[Douyin SPI] 预售券取消订单处理失败:', { logId, ...summary, errorCode, error: error.message });
      await saveCallbackLog({ type: 'spi_order_cancel', stage: 'error', logId, ...summary, errorCode, error: error.message });
      return res.status(200).json({
        data: { error_code: errorCode, description: error.message, cancel_mode: 2 }
      });
    }
  });

  return router;
}

module.exports = createDouyinExternalRouter();
module.exports.createDouyinExternalRouter = createDouyinExternalRouter;
