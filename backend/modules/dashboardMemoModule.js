"use strict";

const dashboardService = require("./dashboard/dashboard.service");

module.exports = {
  getMemosByDate: (memoDate) => dashboardService.listMemos(memoDate).then((result) => result.memos),
  createMemo: dashboardService.createMemo,
  updateMemo: dashboardService.updateMemo,
  deleteMemo: dashboardService.deleteMemo
};
