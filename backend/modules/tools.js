"use strict";
const Decimal = require('decimal.js');
const { query } = require('../database/postgreDB/pg')

function formatDate(dateInput) {
  if (dateInput == null || dateInput === '') return null;

  if (typeof dateInput === 'string') {
    const ymd = dateInput.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    throw new Error(`无效的日期格式: ${dateInput}`);
  }

  // 兼容 pg 可能返回的 Date 对象（仅用于格式化展示，不做时区换算）
  if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  throw new Error(`无效的日期格式: ${String(dateInput)}`);
}

function isRestRoom(check_in_date, check_out_date) {
  const checkIn = formatDate(check_in_date);
  const checkOut = formatDate(check_out_date);
  if (!checkIn || !checkOut) return false;
  return checkIn === checkOut;
}

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
})

function toDecimal(value) {
  if (Decimal.isDecimal(value)) {
    return value
  }
  if (value === undefined || value === null || value === '') {
    return new Decimal(0)
  }
  try {
    return new Decimal(value)
  } catch (error) {
    return new Decimal(0)
  }
}

function toAmountNumber(value) {
  const decimalValue = Decimal.isDecimal(value) ? value : toDecimal(value)
  return Number(decimalValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())
}

function generateOrderNumber() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `O${year}${month}${day}${random}`
}

/**
 * 根据房型和入住区间随机分配一个可用房号。
 * @param {string} roomType 房型编码（对应 rooms.type_code）
 * @param {string} checkInDate 入住日期（YYYY-MM-DD）
 * @param {string} checkOutDate 退房日期（YYYY-MM-DD）
 * @returns {Promise<string|null>} 返回随机可用房号；无可用房时返回 null
 * @throws {Error} 参数缺失或数据库查询失败时抛出异常
 */
async function randomRoomNumber(roomType, checkInDate, checkOutDate) {
  // 房间分配参与占用冲突计算的订单状态。
  const activeOrderStatuses = ['pending', 'reserved', 'checked-in', 'occupied'];
  // 入住日期字符串，统一裁剪为 YYYY-MM-DD，避免携带时间部分。
  const normalizedCheckInDate = String(checkInDate || '').split('T')[0];
  // 退房日期字符串，统一裁剪为 YYYY-MM-DD。
  const normalizedCheckOutDate = String(checkOutDate || '').split('T')[0];

  if (!roomType || !normalizedCheckInDate || !normalizedCheckOutDate) {
    const invalidParamError = new Error('随机分配房间失败：roomType、checkInDate、checkOutDate 为必填参数');
    invalidParamError.code = 'INVALID_ROOM_ASSIGN_PARAMS';
    throw invalidParamError;
  }

  // 按房型筛选可用房，并排除在所选日期区间内已有有效订单占用的房间。
  const findAvailableRoomsSql = `
    SELECT r.room_number
    FROM rooms r
    WHERE r.type_code = $1
      AND r.is_closed = FALSE
      AND r.status <> 'repair'
      AND NOT EXISTS (
        SELECT 1
        FROM orders o
        WHERE o.room_number = r.room_number
          AND o.status = ANY($4::text[])
          AND o.stay_date >= $2::date
          AND o.stay_date < (
            CASE
              WHEN $2::date = $3::date THEN ($2::date + 1)
              ELSE $3::date
            END
          )
      )
    ORDER BY r.room_number
  `;

  const availableRoomResult = await query(findAvailableRoomsSql, [
    roomType,
    normalizedCheckInDate,
    normalizedCheckOutDate,
    activeOrderStatuses
  ]);

  if (!availableRoomResult.rows.length) {
    return null;
  }

  // 在可用房间集合内随机选一个房间号返回。
  const randomIndex = Math.floor(Math.random() * availableRoomResult.rows.length);
  return availableRoomResult.rows[randomIndex].room_number;
}

module.exports = {
  isRestRoom,
  formatDate,
  toDecimal,
  toAmountNumber,
  generateOrderNumber,
  randomRoomNumber

};
