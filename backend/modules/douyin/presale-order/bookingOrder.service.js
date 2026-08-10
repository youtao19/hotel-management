"use strict";

const availabilityRepository = require('../availability/availability.repository');
const bookableCheckService = require('../availability/bookableCheck.service');
const { resolveContact } = require('./presaleOrder.service');
const repository = require('./bookingOrder.repository');

/** 创建预约订单业务错误。 */
function createBookingError(message, errorCode = 13) {
  const error = new Error(message);
  error.douyinErrorCode = errorCode;
  return error;
}

/** 规范抖音传入的整数分金额。 */
function normalizeCents(value, fieldName) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) {
    throw createBookingError(`${fieldName} 格式错误`, 13);
  }
  return amount;
}

/** 校验 YYYY-MM-DD 日期字符串，避免把 DATE 按时区转换。 */
function normalizeDate(value, fieldName) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createBookingError(`${fieldName} 格式错误`, 5);
  }
  const [year, month, day] = date.split('-').map(Number);
  const nativeDate = new Date(Date.UTC(year, month - 1, day));
  if (nativeDate.getUTCFullYear() !== year || nativeDate.getUTCMonth() !== month - 1 || nativeDate.getUTCDate() !== day) {
    throw createBookingError(`${fieldName} 格式错误`, 5);
  }
  return date;
}

/** 生成入住日至离店日前一日的日期字符串。 */
function buildStayDates(checkInDate, checkOutDate) {
  const [startYear, startMonth, startDay] = checkInDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = checkOutDate.split('-').map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  if (end <= start) {
    throw createBookingError('离店日期必须晚于入住日期', 5);
  }
  const dates = [];
  for (let current = start; current < end; current += 24 * 60 * 60 * 1000) {
    const date = new Date(current);
    dates.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`);
  }
  return dates;
}

/** 校验预约单日单间价格与入住区间一致。 */
function normalizeDailyRates(value, stayDates, numberOfUnits, totalAmount) {
  if (!Array.isArray(value) || value.length !== stayDates.length) {
    throw createBookingError('daily_rates 与入住天数不一致', 8);
  }
  const expectedDates = new Set(stayDates);
  const rates = value.map((item) => {
    const periodStartDate = normalizeDate(item?.period_start_date, 'daily_rates.period_start_date');
    const periodEndDate = normalizeDate(item?.period_end_date, 'daily_rates.period_end_date');
    const originalAmount = normalizeCents(item?.original_amount, 'daily_rates.original_amount');
    if (!expectedDates.delete(periodStartDate)) {
      throw createBookingError('daily_rates 日期重复或不属于入住区间', 8);
    }
    const expectedEndDate = buildStayDates(periodStartDate, periodEndDate);
    if (expectedEndDate.length !== 1) {
      throw createBookingError('daily_rates 必须按单日单间传入', 8);
    }
    return { periodStartDate, periodEndDate, originalAmount };
  }).sort((left, right) => left.periodStartDate.localeCompare(right.periodStartDate));

  if (expectedDates.size || rates.some((rate, index) => rate.periodStartDate !== stayDates[index])) {
    throw createBookingError('daily_rates 日期不连续', 8);
  }
  const expectedTotal = rates.reduce((sum, rate) => sum + rate.originalAmount, 0) * numberOfUnits;
  if (expectedTotal !== totalAmount) {
    throw createBookingError('订单金额与 daily_rates 不一致', 8);
  }
  return rates;
}

/** 从联系人或入住人中提取写入本地订单表的客人信息。 */
function resolveGuest(payload) {
  const contact = resolveContact(payload);
  const firstOccupancy = Array.isArray(payload.occupancies) ? payload.occupancies[0] : null;
  if (!firstOccupancy) {
    return { name: contact.name || '抖音客人', phone: contact.phone || '' };
  }
  const occupancy = resolveContact({ contact_info: firstOccupancy });
  return { name: occupancy.name || contact.name || '抖音客人', phone: occupancy.phone || contact.phone || '' };
}

/** 校验并整理抖音创建预约 SPI 请求。 */
function normalizeBookingPayload(payload = {}) {
  const orderId = String(payload.order_id || '').trim();
  const sourceOrderId = String(payload.source_order_id || '').trim();
  const ratePlanId = String(payload.rate_plan_id || '').trim();
  const hotelId = String(payload.hotel_id || '').trim();
  const roomId = String(payload.room_id || '').trim();
  const numberOfUnits = Number(payload.number_of_units);
  const numberOfGuests = Number(payload.number_of_guests);
  const totalAmount = normalizeCents(payload.total_amount, 'total_amount');
  const bizType = Number(payload.biz_type);
  const checkInDate = normalizeDate(payload.check_in_date, 'check_in_date');
  const checkOutDate = normalizeDate(payload.check_out_date, 'check_out_date');
  if (!orderId || !sourceOrderId || !ratePlanId || !hotelId || !roomId || bizType !== 2012) {
    throw createBookingError('预约订单请求参数不合法', 13);
  }
  if (!Number.isInteger(numberOfUnits) || numberOfUnits <= 0 || !Number.isInteger(numberOfGuests) || numberOfGuests <= 0) {
    throw createBookingError('入住间数或入住人数格式错误', 13);
  }
  const stayDates = buildStayDates(checkInDate, checkOutDate);
  return {
    orderId,
    sourceOrderId,
    ratePlanId,
    hotelId,
    roomId,
    numberOfUnits,
    numberOfGuests,
    totalAmount,
    checkInDate,
    checkOutDate,
    currency: String(payload.currency || 'CNY').trim() || 'CNY',
    dailyRates: normalizeDailyRates(payload.daily_rates, stayDates, numberOfUnits, totalAmount)
  };
}

/** 校验预约请求的抖音酒店、房型与本地映射一致。 */
async function assertBookingMapping(booking) {
  const ratePlan = await availabilityRepository.findRatePlanByDouyinId(booking.ratePlanId);
  if (!ratePlan || String(ratePlan.douyin_room_id || '') !== booking.roomId) {
    throw createBookingError('房型不存在或已失效', 1);
  }
  if (ratePlan.hotel_id && String(ratePlan.hotel_id) !== booking.hotelId) {
    throw createBookingError('酒店与售卖房型不匹配', 1);
  }
  return ratePlan;
}

/** 复用可订检查的价量态规则，避免预约创单绕过库存校验。 */
async function assertBookable(booking) {
  const result = await bookableCheckService.buildBookableCheckResponse({
    rate_plan_id: booking.ratePlanId,
    biz_type: 2012,
    check_in_date: booking.checkInDate,
    check_out_date: booking.checkOutDate,
    number_of_units: booking.numberOfUnits,
    number_of_guests: booking.numberOfGuests,
    total_amount: booking.totalAmount
  });
  if (Number(result.error_code) !== 0) {
    throw createBookingError(result.description || '预约不可订', Number(result.error_code) || 13);
  }
}

/** 创建本地预约单并返回异步接单信息。 */
async function createBooking(payload, options = {}) {
  const booking = normalizeBookingPayload(payload);
  const client = await repository.getClient();
  try {
    await client.query('BEGIN');
    const existing = await repository.findByDouyinOrderId(booking.orderId, client);
    if (existing) {
      await client.query('COMMIT');
      return {
        douyinOrderId: existing.ota_order_id,
        localOrderId: existing.order_id,
        confirmNumber: existing.confirm_number,
        duplicate: true,
        needsConfirmation: existing.confirm_status !== 'CONFIRMED'
      };
    }

    const sourceOrder = await repository.findPaidSourceOrder(booking.sourceOrderId, client);
    if (!sourceOrder) {
      throw createBookingError('来源预售券订单不存在或未支付', 9);
    }
    const mapping = await assertBookingMapping(booking);
    await assertBookable(booking);
    const assignedRooms = await repository.lockAvailableRooms(
      client,
      mapping.room_type_code,
      booking.checkInDate,
      booking.checkOutDate,
      booking.numberOfUnits
    );
    if (assignedRooms.length !== booking.numberOfUnits) {
      throw createBookingError('入住时期内已满', 4);
    }

    const guest = resolveGuest(payload);
    const localOrderId = `DYBK${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const created = await repository.insertBooking(client, {
      ...booking,
      douyinOrderId: booking.orderId,
      localOrderId,
      confirmNumber: localOrderId,
      accountId: options.accountId,
      assignedRooms,
      occupancies: payload.occupancies || [],
      contactInfo: payload.contact_info || {},
      rawPayload: payload,
      logId: options.logId
    });
    await repository.insertBookingOrderDays(client, {
      ...booking,
      douyinOrderId: booking.orderId,
      localOrderId,
      assignedRooms,
      roomTypeCode: mapping.room_type_code,
      guestName: guest.name,
      guestPhone: guest.phone
    });
    await client.query('COMMIT');
    return {
      douyinOrderId: created.ota_order_id,
      localOrderId: created.order_id,
      confirmNumber: created.confirm_number,
      duplicate: false,
      needsConfirmation: true
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  buildStayDates,
  createBooking,
  createBookingError,
  normalizeBookingPayload,
  normalizeDailyRates
};
