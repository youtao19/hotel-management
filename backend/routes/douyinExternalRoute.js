"use strict";

const express = require('express');
const redisDb = require('../database/redis/redis');
const signatureService = require('../services/douyinSignatureService');
const webhookService = require('../services/douyinWebhookService');
const priceVolumeService = require('../services/douyinPriceVolumeService');

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
    try {
      if (!signatureService.verifyWebhookSignature(req)) {
        return res.status(401).json({ message: '抖音 Webhook 签名校验失败' });
      }

      const payload = webhookService.parseWebhookPayload(req.body);
      if (payload.event === 'verify_webhook') {
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
        return res.status(200).json(successResponse());
      }

      console.log('[Douyin Webhook] 已接收消息:', webhookService.buildWebhookLog(payload, {
        msgId,
        logId: getHeader(req, 'x-bytedance-logid')
      }));

      return res.status(200).json(successResponse());
    } catch (error) {
      const statusCode = Number(error.statusCode || error.status || 500);
      console.error('[Douyin Webhook] 处理失败:', error);
      return res.status(statusCode).json({
        message: statusCode >= 500 ? '服务器错误' : error.message,
        error: error.message
      });
    }
  });

  router.post('/spi/price-volume', async (req, res) => {
    try {
      if (!signatureService.verifySpiSignature(req)) {
        return res.status(401).json({ message: '抖音 SPI 签名校验失败' });
      }

      const data = await priceVolumeService.buildPriceVolumeResponse(req.body || {});
      return res.status(200).json({ data });
    } catch (error) {
      console.error('[Douyin SPI] 价量态拉取处理失败:', error);
      return res.status(500).json({
        data: {
          error_code: 13,
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
