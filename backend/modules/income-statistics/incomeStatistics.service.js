"use strict";

const repository = require("./incomeStatistics.repository");

async function getSeries({ startDate, endDate, bucket, roomType }) {
  if (bucket === "daily") {
    return repository.getDailyRevenue(startDate, endDate, roomType);
  }

  if (bucket === "weekly") {
    return repository.getWeeklyRevenue(startDate, endDate, roomType);
  }

  return repository.getMonthlyRevenue(startDate, endDate, roomType);
}

async function getRoomTypeRevenue(startDate, endDate) {
  return repository.getRoomTypeRevenue(startDate, endDate);
}

async function getQuickStats(selectedToday) {
  const {
    currentToday,
    today,
    thisWeekStartStr,
    thisMonthStartStr,
    todayStats,
    weekStats,
    monthStats
  } = await repository.getQuickStatsSummary(selectedToday || null);

  return {
    currentToday,
    today,
    thisWeekStartStr,
    thisMonthStartStr,
    data: {
      today: {
        ...todayStats,
        period: "today",
        date: today,
        label: selectedToday ? `${today} 收入` : "今日收入"
      },
      thisWeek: {
        ...weekStats,
        period: "thisWeek",
        startDate: thisWeekStartStr,
        endDate: currentToday
      },
      thisMonth: {
        ...monthStats,
        period: "thisMonth",
        startDate: thisMonthStartStr,
        endDate: currentToday
      }
    }
  };
}

async function getRevenueBills(filters) {
  return repository.getRevenueBillDetails(filters);
}

async function getDailyDetails({ startDate, endDate, roomType }) {
  return repository.getDailyRevenueDetails(startDate, endDate, roomType);
}

module.exports = {
  getDailyDetails,
  getQuickStats,
  getRevenueBills,
  getRoomTypeRevenue,
  getSeries
};
