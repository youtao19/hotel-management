"use strict";

const reviewRepository = require("./review/review.repository");

// 兼容旧模块引用；好评管理的业务边界已迁移到 backend/modules/review。
module.exports = {
  inviteReview: async (orderId) => {
    await reviewRepository.inviteReview(orderId);
    return reviewRepository.getOrderWithReviewInfo(orderId);
  },
  updateReviewStatus: async (orderId, positiveReview) => {
    await reviewRepository.updateReviewStatus(orderId, positiveReview);
    return reviewRepository.getOrderWithReviewInfo(orderId);
  },
  getOrderWithReviewInfo: reviewRepository.getOrderWithReviewInfo,
  getReviewByOrderId: reviewRepository.getReviewByOrderId,
  getPendingReviewInvitations: reviewRepository.getPendingReviewInvitations,
  getPendingReviewUpdates: reviewRepository.getPendingReviewUpdates,
  getAllReviewOrders: reviewRepository.getAllReviewOrders,
  getReviewStatistics: reviewRepository.getReviewStatistics
};
