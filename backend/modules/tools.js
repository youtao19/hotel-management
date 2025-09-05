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

module.exports = {
  isRestRoom
};
