"use strict";

const service = require("./shiftHandover.service");
const validator = require("./shiftHandover.validator");

function sendValidationError(res, error) {
  return res.status(error.status).json(error.body);
}

async function getOverview(req, res) {
  try {
    const parsed = validator.readDateQuery(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const data = await service.getOverview({
      date: parsed.value.date,
      account: req.session?.account
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching handover overview:", error);
    return res.status(500).json({ success: false, message: error.message || "获取交接班数据失败" });
  }
}

async function getHandoverTable(req, res) {
  try {
    const parsed = validator.readDateQuery(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const tableData = await service.getTableData(parsed.value.date);
    return res.json({ success: true, data: tableData });
  } catch (error) {
    console.error("Error fetching handover table data:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "获取交接班数据失败"
    });
  }
}

async function getSpecialStats(req, res) {
  try {
    const parsed = validator.readDateQuery(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const data = await service.getSpecialStats(parsed.value.date);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("获取交接班特殊统计失败:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getAdminMemos(req, res) {
  try {
    const parsed = validator.readDateQuery(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const memos = await service.getAdminMemos(parsed.value.date);
    return res.json({
      success: true,
      data: memos,
      message: "获取管理员备忘录成功"
    });
  } catch (error) {
    console.error("获取管理员备忘录失败:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "获取管理员备忘录失败"
    });
  }
}

async function queryHandoverRecords(_req, res) {
  try {
    console.log("开始查询交接班记录");
    const handoverRecords = await service.listRecords();
    console.log(`找到 ${handoverRecords.length} 条交接班记录`);

    return res.json({
      success: true,
      data: handoverRecords,
      message: `成功查询到 ${handoverRecords.length} 条交接班记录`
    });
  } catch (error) {
    console.error("查询交接班记录失败:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "查询交接班记录失败"
    });
  }
}

async function completeHandover(req, res) {
  try {
    const parsed = validator.readCompleteHandoverBody(req.body);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const operatorName = service.resolveOperatorName({
      handoverPerson: parsed.value.handoverPerson,
      account: req.session?.account
    });

    console.log("收到完成交接班请求:", {
      date: parsed.value.date,
      handoverPerson: operatorName,
      receivePerson: parsed.value.receivePerson,
      vipCard: parsed.value.vipCard || 0,
      timestamp: new Date().toLocaleString("zh-CN", { hour12: false })
    });

    const data = await service.completeHandover({
      body: parsed.value,
      account: req.session?.account
    });

    console.log("交接班记录保存完成，共", data.recordCount, "条");

    return res.json({
      success: true,
      message: "交接班完成，数据已保存",
      data
    });
  } catch (error) {
    console.error("完成交接班失败:", {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      message: error.message || "完成交接班失败"
    });
  }
}

module.exports = {
  completeHandover,
  getAdminMemos,
  getHandoverTable,
  getOverview,
  getSpecialStats,
  queryHandoverRecords
};
