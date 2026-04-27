"use strict";

const express = require('express');
const redisDb = require('../database/redis/redis');
const signatureService = require('../services/douyinSignatureService');
const webhookService = require('../services/douyinWebhookService');
const priceVolumeService = require('../services/douyinPriceVolumeService');
const callbackLogService = require('../services/douyinCallbackLogService');

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

  return router;
}

module.exports = createDouyinExternalRouter();
module.exports.createDouyinExternalRouter = createDouyinExternalRouter;
