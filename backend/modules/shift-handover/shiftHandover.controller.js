"use strict";

const service = require("./shiftHandover.service");
const validator = require("./shiftHandover.validator");

function sendValidationError(res, error) {
  return res.status(error.status).json(error.body);
}

async function getOverview(req, res) {
  try {
    const parsed = validator.readOverviewQuery(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const data = await service.getOverview({
      date: parsed.value.date,
      account: req.account
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

/**
 * 获取交接表金额的来源明细；是否读取快照由服务层按交接完成状态决定。
 */
async function getSourceDetails(req, res) {
  try {
    const parsed = validator.readSourceDetailsQuery(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const data = await service.getSourceDetails(parsed.value);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("获取交接班来源明细失败:", error);
    return res.status(500).json({ success: false, message: error.message || "获取来源明细失败" });
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


async function completeHandover(req, res) {
  try {
    const parsed = validator.readCompleteHandoverBody(req.body);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const operatorName = service.resolveOperatorName({
      handoverPerson: parsed.value.handoverPerson,
      account: req.account
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
      account: req.account
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

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "完成交接班失败"
    });
  }
}

/**
 * 保存指定营业日的现金备用金与留存款；金额来源固定在后端设置表，不接受交接金额等派生数据。
 */
async function setDailyCashReserve(req, res) {
  try {
    const parsed = validator.readDailyCashReserveBody(req.body);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const data = await service.setDailyCashReserve({
      ...parsed.value,
      account: req.account
    });
    return res.json({ success: true, data, message: "今日现金备用金与留存款已保存" });
  } catch (error) {
    console.error("保存今日现金备用金失败:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "保存今日现金备用金与留存款失败"
    });
  }
}

module.exports = {
  completeHandover,
  getAdminMemos,
  getHandoverTable,
  getSourceDetails,
  getOverview,
  getSpecialStats,
  setDailyCashReserve
};
