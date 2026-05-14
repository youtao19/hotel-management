"use strict";

const orderManageService = require("../order-manage/orderManage.service");
const reviewRepository = require("./review.repository");

function firstOrderRow(orderRows) {
  return Array.isArray(orderRows) ? orderRows[0] : orderRows;
}

function createClientError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function listPendingInvitations() {
  return reviewRepository.getPendingReviewInvitations();
}

async function listPendingReviews() {
  return reviewRepository.getPendingReviewUpdates();
}

/**
 * 邀请指定订单参与好评。
 * 先确认订单存在，避免为无效订单写入邀请记录。
 */
async function inviteReview(orderId) {
  const order = firstOrderRow(await orderManageService.getOrder(orderId));
  if (!order) {
    throw createClientError(404, "订单不存在");
  }

  await reviewRepository.inviteReview(orderId);
  return {
    order,
    reviewOrder: await reviewRepository.getOrderWithReviewInfo(orderId)
  };
}

/**
 * 标记指定订单是否获得好评。
 * 未邀请的订单不能直接设置结果，避免评价状态跳过邀约流程。
 */
async function updateReviewStatus(orderId, positiveReview) {
  const order = firstOrderRow(await orderManageService.getOrder(orderId));
  if (!order) {
    throw createClientError(404, "订单不存在");
  }

  const reviewInfo = await reviewRepository.getReviewByOrderId(orderId);
  if (!reviewInfo || !reviewInfo.invited) {
    throw createClientError(400, "尚未邀请好评，无法设置好评状态");
  }

  await reviewRepository.updateReviewStatus(orderId, positiveReview);
  return {
    order,
    reviewOrder: await reviewRepository.getOrderWithReviewInfo(orderId)
  };
}

async function listAllReviews(options = {}) {
  return reviewRepository.getAllReviewOrders(options);
}

async function getReviewStatistics(options = {}) {
  return reviewRepository.getReviewStatistics(options);
}

/**
 * 查询单笔订单的好评信息。
 * 订单响应沿用旧接口的 getOrder 返回值，避免影响前端兼容多日订单。
 */
async function getReviewByOrderId(orderId) {
  const order = await orderManageService.getOrder(orderId);
  if (!order) {
    throw createClientError(404, "订单不存在");
  }

  return {
    order,
    review: await reviewRepository.getReviewByOrderId(orderId)
  };
}

async function getOrderWithReviewInfo(orderId) {
  return reviewRepository.getOrderWithReviewInfo(orderId);
}

module.exports = {
  getOrderWithReviewInfo,
  getReviewByOrderId,
  getReviewStatistics,
  inviteReview,
  listAllReviews,
  listPendingInvitations,
  listPendingReviews,
  updateReviewStatus
};
