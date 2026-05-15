"use strict";

const service = require("./incomeStatistics.service");
const validator = require("./incomeStatistics.validator");

function sendValidationError(res, error) {
  return res.status(error.status).json(error.body);
}

async function getSeries(req, res) {
  try {
    const parsed = validator.readDateRange(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const bucketResult = validator.readSeriesBucket(req.query);
    if (bucketResult.error) return sendValidationError(res, bucketResult.error);

    const { startDate, endDate, roomType } = parsed.value;
    const bucket = bucketResult.value;
    const data = await service.getSeries({ startDate, endDate, bucket, roomType });

    return res.json({
      message: "获取收入聚合序列成功",
      data,
      period: {
        startDate,
        endDate,
        bucket,
        roomType: roomType || null
      }
    });
  } catch (error) {
    console.error("获取收入聚合序列失败:", error);
    return res.status(500).json({
      message: "获取收入聚合序列失败",
      error: error.message
    });
  }
}

async function getRoomTypeRevenue(req, res) {
  try {
    const parsed = validator.readDateRange(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const { startDate, endDate } = parsed.value;
    const data = await service.getRoomTypeRevenue(startDate, endDate);

    return res.json({
      message: "获取房型收入统计成功",
      data,
      period: {
        startDate,
        endDate,
        type: "room-type"
      }
    });
  } catch (error) {
    console.error("获取房型收入统计失败:", error);
    return res.status(500).json({
      message: "获取房型收入统计失败",
      error: error.message
    });
  }
}

async function getQuickStats(req, res) {
  try {
    const parsed = validator.readQuickStatsQuery(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const result = await service.getQuickStats(parsed.value.selectedToday);

    return res.json({
      message: "获取快速统计数据成功",
      data: result.data
    });
  } catch (error) {
    console.error("获取快速统计数据失败:", error);
    return res.status(500).json({
      message: "获取快速统计数据失败",
      error: error.message
    });
  }
}

async function getRevenueBills(req, res) {
  try {
    const parsed = validator.readBillFilters(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const data = await service.getRevenueBills(parsed.value);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("获取收入账单明细失败:", error);
    return res.status(500).json({
      success: false,
      message: "获取收入账单明细失败",
      error: error.message
    });
  }
}

async function getDailyDetails(req, res) {
  try {
    const parsed = validator.readDailyDetailsDateRange(req.query);
    if (parsed.error) return sendValidationError(res, parsed.error);

    const data = await service.getDailyDetails(parsed.value);

    return res.json({
      success: true,
      data,
      message: `获取每日营收明细成功，共 ${data.length} 条记录`
    });
  } catch (error) {
    console.error("获取每日营收明细失败:", error);
    return res.status(500).json({
      success: false,
      message: "获取每日营收明细失败: " + error.message
    });
  }
}

module.exports = {
  getDailyDetails,
  getQuickStats,
  getRevenueBills,
  getRoomTypeRevenue,
  getSeries
};
