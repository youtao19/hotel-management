"use strict";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SERIES_BUCKETS = ["daily", "weekly", "monthly"];

function isDateString(value) {
  return DATE_REGEX.test(String(value || ""));
}

function readDateRange(query = {}) {
  const { startDate, endDate, roomType } = query;

  if (!startDate || !endDate) {
    return {
      error: {
        status: 400,
        body: {
          message: "请提供开始日期和结束日期",
          error: "startDate and endDate are required"
        }
      }
    };
  }

  if (!isDateString(startDate) || !isDateString(endDate)) {
    return {
      error: {
        status: 400,
        body: {
          message: "日期格式错误，请使用YYYY-MM-DD格式",
          error: "Invalid date format"
        }
      }
    };
  }

  return {
    value: {
      startDate: String(startDate),
      endDate: String(endDate),
      roomType: roomType || undefined
    }
  };
}

function readDailyDetailsDateRange(query = {}) {
  const { startDate, endDate, roomType } = query;

  if (!startDate || !endDate) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message: "缺少必需的参数: startDate, endDate"
        }
      }
    };
  }

  if (!isDateString(startDate) || !isDateString(endDate)) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message: "日期格式错误，请使用YYYY-MM-DD格式"
        }
      }
    };
  }

  return {
    value: {
      startDate: String(startDate),
      endDate: String(endDate),
      roomType: roomType || undefined
    }
  };
}

function readSeriesBucket(query = {}) {
  const bucket = String(query.bucket || "").trim();

  if (!SERIES_BUCKETS.includes(bucket)) {
    return {
      error: {
        status: 400,
        body: {
          message: "bucket 参数错误，请使用 daily/weekly/monthly",
          error: "Invalid bucket"
        }
      }
    };
  }

  return { value: bucket };
}

function readQuickStatsQuery(query = {}) {
  const { baseDate, startDate, endDate } = query;
  const hasRange = startDate && endDate;
  const normalizedStart = startDate ? String(startDate) : null;
  const normalizedEnd = endDate ? String(endDate) : null;

  if (hasRange && (!isDateString(normalizedStart) || !isDateString(normalizedEnd))) {
    return {
      error: {
        status: 400,
        body: {
          message: "日期格式错误，请使用YYYY-MM-DD格式",
          error: "Invalid date format"
        }
      }
    };
  }

  if (baseDate && !isDateString(baseDate)) {
    return {
      error: {
        status: 400,
        body: {
          message: "日期格式错误，请使用YYYY-MM-DD格式",
          error: "Invalid baseDate format"
        }
      }
    };
  }

  let selectedToday = null;
  if (baseDate) {
    selectedToday = String(baseDate);
  } else if (hasRange && normalizedStart === normalizedEnd) {
    selectedToday = normalizedStart;
  }

  return { value: { selectedToday } };
}

function readBillFilters(query = {}) {
  const {
    date,
    roomNumber,
    orderId,
    guestName,
    payWay,
    changeType
  } = query;

  if (date && !isDateString(date)) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message: "date 日期格式错误，请使用YYYY-MM-DD"
        }
      }
    };
  }

  return {
    value: {
      date: date || undefined,
      roomNumber: roomNumber ? String(roomNumber).trim() : undefined,
      orderId: orderId ? String(orderId).trim() : undefined,
      guestName: guestName ? String(guestName).trim() : undefined,
      payWay: payWay ? String(payWay).trim() : undefined,
      changeType: changeType ? String(changeType).trim() : undefined
    }
  };
}

module.exports = {
  isDateString,
  readBillFilters,
  readDailyDetailsDateRange,
  readDateRange,
  readQuickStatsQuery,
  readSeriesBucket
};
