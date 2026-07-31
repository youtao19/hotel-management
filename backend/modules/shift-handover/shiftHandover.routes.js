"use strict";

const express = require("express");
const controller = require("./shiftHandover.controller");

const router = express.Router();

// 获取当前交接班页面的一次性汇总数据。
router.get("/overview", controller.getOverview);

// 设置当天现金备用金；交接完成后由服务层拒绝修改。
router.put("/daily-cash-reserve", controller.setDailyCashReserve);

// 获取已保存的交接班表格数据。
router.get("/handover-table", controller.getHandoverTable);

// 获取交接表可追溯金额的账单来源明细。
router.get("/source-details", controller.getSourceDetails);

// 获取交接班页面的开房、休息房和好评统计。
router.get("/special-stats", controller.getSpecialStats);

// 获取交接班表中的管理员备忘录。
router.get("/admin-memos", controller.getAdminMemos);

// 完成交接班并保存四种支付方式的核对结果。
router.post("/complete", controller.completeHandover);

module.exports = router;
