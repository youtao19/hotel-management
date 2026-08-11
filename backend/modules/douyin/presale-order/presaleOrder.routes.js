"use strict";

const express = require('express');
const repository = require('./presaleOrder.repository');
const cancelAuditRepository = require('./cancelAudit.repository');
const cancelAuditService = require('./cancelAudit.service');
const accommodationSyncService = require('./accommodationSync.service');
const bookingRepository = require('./bookingOrder.repository');
const bookingConfirmService = require('./bookingConfirm.service');
const douyinSettingsService = require('../settings/douyinSettings.service');

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

/** 返回待处理或已回传的抖音取消人工审核记录。 */
router.get('/cancel-audits', async (req, res) => {
  const status = String(req.query.status || '').trim().toUpperCase();
  if (status && !['PENDING', 'CALLBACK_PENDING', 'APPROVED', 'REJECTED', 'CALLBACK_FAILED'].includes(status)) {
    return res.status(400).json({ message: '审核状态筛选值不合法' });
  }
  try {
    const audits = await cancelAuditRepository.listAudits(status || null);
    return res.status(200).json({ data: audits, message: '取消人工审核列表获取成功' });
  } catch (error) {
    console.error('[Douyin Presale Cancel Audit] 获取审核列表失败:', { error: error.message });
    return res.status(500).json({ message: '获取取消人工审核列表失败' });
  }
});

/** 返回预约订单，供员工在关闭自动接单后逐笔处理。 */
router.get('/bookings', async (_req, res) => {
  try {
    const bookings = await bookingRepository.listBookings();
    return res.status(200).json({ data: bookings, message: '抖音预约订单列表获取成功' });
  } catch (error) {
    console.error('[Douyin Presale Booking] 获取预约订单列表失败:', { error: error.message });
    return res.status(500).json({ message: '获取抖音预约订单失败' });
  }
});

/** 在关闭自动接单后，手动向抖音回传接单或拒单结果。 */
router.post('/bookings/:orderId/confirmation', async (req, res) => {
  const orderId = String(req.params.orderId || '').trim();
  const confirmResult = Number(req.body?.confirmResult);
  const rejectReason = String(req.body?.rejectReason || '').trim();
  if (!orderId) return res.status(400).json({ message: '本地预约订单号不能为空' });
  if (![1, 2].includes(confirmResult)) return res.status(400).json({ message: '确认结果仅支持接单或拒单' });
  if (confirmResult === 2 && !rejectReason) return res.status(400).json({ message: '拒单时必须填写原因' });

  try {
    if (await douyinSettingsService.isAutoConfirmEnabled()) {
      return res.status(409).json({ message: '当前已开启自动接单，请先在抖音支持设置中关闭自动接单' });
    }
    const result = await bookingConfirmService.confirmBooking(orderId, {
      confirmResult,
      rejectCode: req.body?.rejectCode,
      rejectReason
    });
    return res.status(200).json({
      data: result,
      message: result.duplicate ? '预约订单已完成接单，无需重复处理' : confirmResult === 1 ? '已确认接单并回传抖音' : '已确认拒单并回传抖音',
      douyin_log_id: result.logId || null
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const douyinLogId = error.douyinLogId || null;
    console.error('[Douyin Presale Booking] 手动确认结果失败:', { orderId, confirmResult, douyinLogId, error: error.message });
    return res.status(statusCode).json({
      message: douyinLogId ? `${error.message}（抖音日志ID：${douyinLogId}）` : error.message,
      douyin_log_id: douyinLogId
    });
  }
});

/** 提交员工审核结论并同步回传抖音。 */
router.post('/cancel-audits/:cancelId/decision', async (req, res) => {
  const cancelId = String(req.params.cancelId || '').trim();
  if (!cancelId) return res.status(400).json({ message: '取消编号不能为空' });
  try {
    const result = await cancelAuditService.reviewCancelAudit(cancelId, req.body || {}, req.account || {});
    return res.status(200).json({
      data: result.audit,
      message: result.duplicate ? '取消申请已完成审核回传' : '取消审核结果已回传抖音',
      douyin_log_id: result.audit.callback_log_id || null
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const douyinLogId = error.douyinLogId || null;
    const message = douyinLogId ? `${error.message}（抖音日志ID：${douyinLogId}）` : error.message;
    console.error('[Douyin Presale Cancel Audit] 审核回传失败:', { cancelId, douyinLogId, error: error.message });
    return res.status(statusCode).json({ message, douyin_log_id: douyinLogId });
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
