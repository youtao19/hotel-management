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


const formatDate = (dateInput) => {
  if (!dateInput) return null;

  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  // 如果是其他格式，转换为本地日期字符串
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    throw new Error(`无效的日期格式: ${dateInput}`);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

    /**
 * 将日期时间格式化为数据库友好的本地时间字符串
 * @param {string|Date|number} [input] - 日期时间输入
 * @returns {string} 形如 YYYY-MM-DD HH:mm:ss.SSS000 的本地时间
 */
function formatDateTimeForDB(input) {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error(`无效的日期时间格式: ${input}`);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const millis = String(date.getMilliseconds()).padStart(3, '0');
  const micros = `${millis}000`; // 与数据库中6位小数保持一致
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${micros}`;
}

module.exports = {
  isRestRoom,
  formatDate,
  formatDateTimeForDB

};
