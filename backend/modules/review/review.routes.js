"use strict";

const express = require("express");
const controller = require("./review.controller");

const router = express.Router();

// 获取待邀请好评的订单列表。
router.get("/pending-invitations", controller.listPendingInvitations);

// 获取已邀请但未设置好评状态的订单列表。
router.get("/pending-reviews", controller.listPendingReviews);

// 获取所有有好评记录的订单，用于统计分析。
router.get("/all", controller.listAllReviews);

// 获取好评统计信息。
router.get("/statistics", controller.getReviewStatistics);

// 邀请指定订单的客户好评。
router.post("/:orderId/invite", controller.inviteReview);

// 更新指定订单的好评状态。
router.put("/:orderId/status", controller.updateReviewStatus);

// 获取指定订单的好评信息。
router.get("/:orderId", controller.getReviewByOrderId);

module.exports = router;
