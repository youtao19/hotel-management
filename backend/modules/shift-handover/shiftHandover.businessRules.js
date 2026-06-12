"use strict";

/**
 * 获取前一天日期，保持 YYYY-MM-DD 字符串格式
 * 使用本地时区构造 Date，禁止 toISOString()
 * @param {string} dateString YYYY-MM-DD
 * @returns {string} YYYY-MM-DD
 */
function getPreviousBusinessDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * 根据本地时间判断当前班次
 * @param {Date} now
 * @returns {{ code: string, label: string, timeRange: string }}
 */
function resolveCurrentShift(now = new Date()) {
  const hour = now.getHours();
  if (hour >= 8 && hour < 16) {
    return { code: "morning", label: "早班", timeRange: "08:00-16:00" };
  }
  if (hour >= 16) {
    return { code: "evening", label: "晚班", timeRange: "16:00-00:00" };
  }
  return { code: "night", label: "夜班", timeRange: "00:00-08:00" };
}

/**
 * 从 account 对象中提取当前用户展示信息
 * @param {Object} account
 * @returns {{ id: number|null, name: string, role: string }}
 */
function resolveCurrentUser(account = {}) {
  return {
    id: account.id || null,
    name: account.username || account.name || account.email || "当前用户",
    role: account.role || "前台",
  };
}

/**
 * 构建默认备用金规则
 * 现金固定 320，微信取昨日完整交接款（isComplete 时），其余为 0
 * @param {{ isComplete: boolean, handoverAmounts: Object }} param0
 * @returns {Object}
 */
function buildReserveDefaults({ isComplete, handoverAmounts }) {
  return {
    "现金": 320,
    "微信": isComplete ? handoverAmounts["微信"] : 0,
    "微邮付": 0,
    "其他": 0,
  };
}

module.exports = {
  buildReserveDefaults,
  getPreviousBusinessDate,
  resolveCurrentShift,
  resolveCurrentUser,
};
