"use strict";

const express = require('express');
const { body, validationResult } = require('express-validator');
const reviewInvitationModule = require('../modules/reviewInvitationModule');
const orderModule = require('../modules/orderModule');

const router = express.Router();

/**
 * 获取待邀请好评的订单列表
 * GET /api/reviews/pending-invitations
 */
router.get('/pending-invitations', async (req, res) => {
  try {
    const pendingOrders = await reviewInvitationModule.getPendingReviewInvitations();
    res.status(200).json({
      message: '获取待邀请好评订单成功',
      orders: pendingOrders
    });
  } catch (error) {
    console.error('获取待邀请好评订单失败:', error);
    res.status(500).json({ message: '获取待邀请好评订单失败', error: error.message });
  }
});

/**
 * 获取已邀请但未设置好评状态的订单列表
 * GET /api/reviews/pending-reviews
 */
router.get('/pending-reviews', async (req, res) => {
  try {
    const pendingReviews = await reviewInvitationModule.getPendingReviewUpdates();
    res.status(200).json({
      message: '获取待更新好评状态订单成功',
      orders: pendingReviews
    });
  } catch (error) {
    console.error('获取待更新好评状态订单失败:', error);
    res.status(500).json({ message: '获取待更新好评状态订单失败', error: error.message });
  }
});

/**
 * 邀请特定订单的客户好评
 * POST /api/reviews/:orderId/invite
 */
router.post('/:orderId/invite', async (req, res) => {
  try {
    const { orderId } = req.params;

    // 检查订单是否存在
    const order = await orderModule.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: '订单不存在' });
    }

    const result = await reviewInvitationModule.inviteReview(orderId);
    res.status(200).json({
      message: `已成功邀请客户 ${order.guest_name} 参与好评`,
      order: result
    });
  } catch (error) {
    console.error('邀请好评失败:', error);
    res.status(500).json({ message: '邀请好评失败', error: error.message });
  }
});

/**
 * 更新特定订单的好评状态
 * PUT /api/reviews/:orderId/status
 */
router.put('/:orderId/status', [
  body('positive_review')
    .isBoolean()
    .withMessage('好评状态必须是布尔值')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { orderId } = req.params;
    const { positive_review } = req.body;

    // 检查订单是否存在
    const order = await orderModule.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: '订单不存在' });
    }

    // 检查是否已经邀请过好评
    const reviewInfo = await reviewInvitationModule.getReviewByOrderId(orderId);
    if (!reviewInfo || !reviewInfo.invited) {
      return res.status(400).json({ message: '尚未邀请好评，无法设置好评状态' });
    }

    const result = await reviewInvitationModule.updateReviewStatus(orderId, positive_review);
    res.status(200).json({
      message: `已将客户 ${order.guest_name} 的评价设置为${positive_review ? '好评' : '未好评'}`,
      order: result
    });
  } catch (error) {
    console.error('更新好评状态失败:', error);
    res.status(500).json({ message: '更新好评状态失败', error: error.message });
  }
});

/**
 * 获取所有有好评记录的订单（用于统计分析）
 * GET /api/reviews/all
 */
router.get('/all', async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const allReviews = await reviewInvitationModule.getAllReviewOrders({
      startDate,
      endDate,
      status
    });

    res.status(200).json({
      message: '获取所有好评记录成功',
      orders: allReviews
    });
  } catch (error) {
    console.error('获取所有好评记录失败:', error);
    res.status(500).json({ message: '获取所有好评记录失败', error: error.message });
  }
});

/**
 * 获取好评统计信息
 * GET /api/reviews/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const statistics = await reviewInvitationModule.getReviewStatistics({
      startDate,
      endDate
    });

    res.status(200).json({
      message: '获取好评统计成功',
      ...statistics
    });
  } catch (error) {
    console.error('获取好评统计失败:', error);
    res.status(500).json({ message: '获取好评统计失败', error: error.message });
  }
});

/**
 * 获取特定订单的好评信息
 * GET /api/reviews/:orderId
 */
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // 检查订单是否存在
    const order = await orderModule.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: '订单不存在' });
    }

    const reviewInfo = await reviewInvitationModule.getReviewByOrderId(orderId);
    res.status(200).json({
      message: '获取好评信息成功',
      order: order,
      review: reviewInfo
    });
  } catch (error) {
    console.error('获取好评信息失败:', error);
    res.status(500).json({ message: '获取好评信息失败', error: error.message });
  }
});

module.exports = router;
