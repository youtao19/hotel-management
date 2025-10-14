"use strict";

// 判断是否为休息房
function isRestRoom(check_in_date, check_out_date) {
  const checkInDate = new Date(check_in_date);
  const checkOutDate = new Date(check_out_date);

  // 比较日期部分，忽略时间
  const checkInDateStr = checkInDate.toISOString().split('T')[0];
  const checkOutDateStr = checkOutDate.toISOString().split('T')[0];

  return checkInDateStr === checkOutDateStr;
}

function formatDate(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput; // 已经是正确格式
  }
  const date = new Date(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  isRestRoom,
  formatDate
};
