"use strict";

const express = require("express");
const controller = require("./incomeStatistics.controller");

const router = express.Router();

// 获取收入趋势序列，支持按日、周、月聚合。
router.get("/series", controller.getSeries);

// 获取房型维度收入贡献。
router.get("/room-type", controller.getRoomTypeRevenue);

// 获取收入统计页顶部快速统计卡。
router.get("/quick-stats", controller.getQuickStats);

// 获取详细收入账单列表。
router.get("/bills", controller.getRevenueBills);

// 获取每日营收明细，统一房费、补收和租车收入口径。
router.get("/daily-details", controller.getDailyDetails);

module.exports = router;
