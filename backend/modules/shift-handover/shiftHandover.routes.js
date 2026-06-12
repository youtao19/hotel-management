"use strict";

const express = require("express");
const controller = require("./shiftHandover.controller");

const router = express.Router();

// 获取当前交接班页面的一次性汇总数据。
router.get("/overview", controller.getOverview);

// 获取已保存的交接班表格数据。
router.get("/handover-table", controller.getHandoverTable);

// 获取交接班页面的开房、休息房和好评统计。
router.get("/special-stats", controller.getSpecialStats);

// 获取交接班表中的管理员备忘录。
router.get("/admin-memos", controller.getAdminMemos);

// 查询已完成的交接班历史记录。
router.get("/query", controller.queryHandoverRecords);

// 完成交接班并保存四种支付方式的核对结果。
router.post("/complete", controller.completeHandover);

module.exports = router;
