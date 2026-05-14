"use strict";

const express = require("express");
const controller = require("./dashboard.controller");

const router = express.Router();

// 查询仪表盘选中日期的备忘录。
router.get("/", controller.listMemos);

// 创建仪表盘备忘录。
router.post("/", controller.createMemo);

// 更新仪表盘备忘录内容、优先级、完成状态或所属日期。
router.put("/:memoId", controller.updateMemo);

// 删除仪表盘备忘录。
router.delete("/:memoId", controller.deleteMemo);

module.exports = router;
