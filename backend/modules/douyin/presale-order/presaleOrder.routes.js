"use strict";

const express = require('express');
const repository = require('./presaleOrder.repository');
const accommodationSyncService = require('./accommodationSync.service');

const router = express.Router();

/** 返回抖音预售券主订单，避免与普通入住订单混在同一列表。 */
router.get('/', async (_req, res) => {
  try {
    const orders = await repository.listOrders();
    return res.status(200).json({ data: orders, message: '抖音预售订单列表获取成功' });
  } catch (error) {
    console.error('[Douyin Presale Order] 获取订单列表失败:', { error: error.message });
    return res.status(500).json({ message: '获取抖音预售订单失败' });
  }
});

/** 重试一笔预售券预约订单的入住或离店履约同步。 */
router.post('/:orderId/accommodation-sync/:status/retry', async (req, res) => {
  const orderId = String(req.params.orderId || '').trim();
  const accommodationStatus = Number(req.params.status);
  if (!orderId) return res.status(400).json({ message: '本地订单号不能为空' });
  if (![accommodationSyncService.ACCOMMODATION_STATUS.CHECKED_IN, accommodationSyncService.ACCOMMODATION_STATUS.CHECKED_OUT].includes(accommodationStatus)) {
    return res.status(400).json({ message: '仅支持重试已入住或已离店状态' });
  }

  try {
    const result = await accommodationSyncService.syncAccommodationStatus(orderId, accommodationStatus);
    if (!result.eligible) return res.status(404).json({ message: '未找到对应的抖音预售券预约订单' });
    const statusCode = result.success === false ? 502 : 200;
    return res.status(statusCode).json({
      data: result.sync,
      message: result.duplicate ? '履约状态已同步，无需重复推送' : result.success === false ? '履约状态同步失败，可稍后重试' : '履约状态同步成功',
      douyin_log_id: result.sync?.douyin_log_id || null
    });
  } catch (error) {
    console.error('[Douyin Presale Accommodation] 手动重试失败:', { orderId, accommodationStatus, error: error.message });
    return res.status(500).json({ message: '履约状态重试失败' });
  }
});

module.exports = router;
