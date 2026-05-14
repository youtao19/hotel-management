"use strict";

const reviewService = require("./review.service");
const {
  formatAjvErrors,
  validatePositiveReview
} = require("./review.validator");

function getErrorStatus(error) {
  return error.statusCode || 500;
}

function sendMappedError(res, error, fallbackMessage, logPrefix) {
  const status = getErrorStatus(error);
  if (status < 500) {
    return res.status(status).json({ message: error.message });
  }

  console.error(logPrefix, error);
  return res.status(500).json({ message: fallbackMessage, error: error.message });
}

/**
 * 给好评管理页提供可发起邀请的订单。
 */
async function listPendingInvitations(req, res) {
  try {
    const pendingOrders = await reviewService.listPendingInvitations();
    return res.status(200).json({
      message: "获取待邀请好评订单成功",
      orders: pendingOrders
    });
  } catch (error) {
    console.error("获取待邀请好评订单失败:", error);
    return res.status(500).json({ message: "获取待邀请好评订单失败", error: error.message });
  }
}

/**
 * 给好评管理页提供已邀请但还没标记评价结果的订单。
 */
async function listPendingReviews(req, res) {
  try {
    const pendingReviews = await reviewService.listPendingReviews();
    return res.status(200).json({
      message: "获取待更新好评状态订单成功",
      orders: pendingReviews
    });
  } catch (error) {
    console.error("获取待更新好评状态订单失败:", error);
    return res.status(500).json({ message: "获取待更新好评状态订单失败", error: error.message });
  }
}

/**
 * 邀请指定订单参与好评。
 * 先确认订单存在，避免为无效订单写入邀请记录。
 */
async function inviteReview(req, res) {
  try {
    const { orderId } = req.params;
    const result = await reviewService.inviteReview(orderId);
    return res.status(200).json({
      message: `已成功邀请客户 ${result.order.guest_name} 参与好评`,
      order: result.reviewOrder
    });
  } catch (error) {
    return sendMappedError(res, error, "邀请好评失败", "邀请好评失败:");
  }
}

/**
 * 标记指定订单是否获得好评。
 * 未邀请的订单不能直接设置结果，避免评价状态跳过邀约流程。
 */
async function updateReviewStatus(req, res) {
  try {
    const isValid = validatePositiveReview(req.body);
    if (!isValid) {
      return res.status(400).json({
        message: "请求数据验证失败",
        errors: formatAjvErrors(validatePositiveReview.errors)
      });
    }

    const { orderId } = req.params;
    const { positive_review } = req.body;
    const result = await reviewService.updateReviewStatus(orderId, positive_review);
    return res.status(200).json({
      message: `已将客户 ${result.order.guest_name} 的评价设置为${positive_review ? "好评" : "未好评"}`,
      order: result.reviewOrder
    });
  } catch (error) {
    return sendMappedError(res, error, "更新好评状态失败", "更新好评状态失败:");
  }
}

/**
 * 给好评管理页提供历史评价记录。
 * 日期和状态筛选继续透传到旧模块，保持现有查询口径。
 */
async function listAllReviews(req, res) {
  try {
    const { startDate, endDate, status } = req.query;
    const allReviews = await reviewService.listAllReviews({
      startDate,
      endDate,
      status
    });

    return res.status(200).json({
      message: "获取所有好评记录成功",
      orders: allReviews
    });
  } catch (error) {
    console.error("获取所有好评记录失败:", error);
    return res.status(500).json({ message: "获取所有好评记录失败", error: error.message });
  }
}

/**
 * 给好评管理页顶部统计卡提供统计数据。
 */
async function getReviewStatistics(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const statistics = await reviewService.getReviewStatistics({
      startDate,
      endDate
    });

    return res.status(200).json({
      message: "获取好评统计成功",
      ...statistics
    });
  } catch (error) {
    console.error("获取好评统计失败:", error);
    return res.status(500).json({ message: "获取好评统计失败", error: error.message });
  }
}

/**
 * 查询单笔订单的好评信息。
 * 订单响应沿用旧接口的 getOrder 返回值，避免影响前端兼容多日订单。
 */
async function getReviewByOrderId(req, res) {
  try {
    const { orderId } = req.params;
    const result = await reviewService.getReviewByOrderId(orderId);
    return res.status(200).json({
      message: "获取好评信息成功",
      order: result.order,
      review: result.review
    });
  } catch (error) {
    return sendMappedError(res, error, "获取好评信息失败", "获取好评信息失败:");
  }
}

module.exports = {
  getReviewByOrderId,
  getReviewStatistics,
  inviteReview,
  listAllReviews,
  listPendingInvitations,
  listPendingReviews,
  updateReviewStatus
};
