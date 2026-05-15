const { formatDate, toAmountNumber } = require('../tools');
const billService = require('../bill/bill.service');
const orderCreateRepository = require('./orderCreate.repository');
const orderManageRepository = require('../order-manage/orderManage.repository');

const DEFAULT_PAY_WAY = '现金';
const ALLOWED_SPLIT_PAY_WAYS = new Set(['现金', '微信', '微邮付', '平台']);

function amountToCents(value) {
  return Math.round(toAmountNumber(value || 0) * 100);
}

function centsToAmount(cents) {
  return toAmountNumber((Number(cents) || 0) / 100);
}

function createCheckInSplitError(message, details = null) {
  const err = new Error(message);
  err.code = 'CHECK_IN_INVALID_SPLIT';
  err.statusCode = 400;
  if (details) err.details = details;
  return err;
}

function normalizePayWay(method, fallback = DEFAULT_PAY_WAY) {
  const normalized = String(method || '').trim();
  if (!normalized) return fallback;
  return ALLOWED_SPLIT_PAY_WAYS.has(normalized) ? normalized : fallback;
}

 /**
  * 必须是非空数组
  * 每项金额必须 > 0
  * 所有项合计必须 == 订单房费总额
  */
function parseSplitArray(rawSplits, expectedCents, label, defaultMethod) {
  if (!Array.isArray(rawSplits) || rawSplits.length === 0) {
    throw createCheckInSplitError(`${label}必须是非空数组`);
  }

  const splits = rawSplits.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw createCheckInSplitError(`${label}第 ${index + 1} 项格式不正确`);
    }
    const method = normalizePayWay(item.method || item.pay_way || item.payWay, defaultMethod);
    const amountCents = amountToCents(item.amount ?? item.change_price ?? item.changePrice);
    if (amountCents <= 0) {
      throw createCheckInSplitError(`${label}第 ${index + 1} 项金额必须大于 0`);
    }
    return { method, cents: amountCents };
  });

  const totalCents = splits.reduce((sum, split) => sum + split.cents, 0);
  if (totalCents !== expectedCents) {
    throw createCheckInSplitError(
      `${label}金额合计不正确，期望 ${centsToAmount(expectedCents)}，实际 ${centsToAmount(totalCents)}`
    );
  }
  return splits;
}

function convertSplitCentsToAmount(splitRows) {
  return splitRows.map((row) => ({
    method: row.method,
    amount: centsToAmount(row.cents)
  }));
}

/**
 * 在办理入住弹窗中，选择了房费拆分，前端会传一个数组(包含支付方式和金额)
 *
 * 默认：每天一条账单，支付方式同订单支付方式，金额=当天total_price。
 */
function normalizeRoomFeePaymentSplits(orderRows, roomFeePaymentSplits, fallbackMethod) {
  const normalizedFallbackMethod = normalizePayWay(fallbackMethod);
  const days = orderRows.map((row) => ({
    stayDate: formatDate(row.stay_date),
    cents: amountToCents(row.total_price)
  }));
  let totalExpectedCents = 0;
  for (const day of days) {
    totalExpectedCents += day.cents;
  }

  const defaultByDay = new Map();
  for (const day of days) {
    defaultByDay.set(day.stayDate, [
      { method: normalizedFallbackMethod, amount: centsToAmount(day.cents) }
    ]);
  }

  if (totalExpectedCents <= 0 || !roomFeePaymentSplits) {
    return defaultByDay;
  }

  if (Array.isArray(roomFeePaymentSplits)) {
    const parsed = parseSplitArray(roomFeePaymentSplits, totalExpectedCents, '房费拆分', normalizedFallbackMethod);
    // 前端按总房费传拆分时，后端按住宿日顺序分摊到每天账单。
    const queue = parsed.map(({ method, cents }) => ({ method, cents }));// 复制一份
    const byDay = new Map();
    let splitIndex = 0;

    for (const day of days) {
      let remainingDay = day.cents; // 这一天还需要多少钱
      const daySplits = [];

      while (remainingDay > 0) {
        // 跳过已经用完的支付方式
        while (splitIndex < queue.length && queue[splitIndex].cents <= 0) splitIndex++;
        if (splitIndex >= queue.length) {
          throw createCheckInSplitError('房费拆分金额不足，无法覆盖全部住宿日');
        }

        const current = queue[splitIndex]; // current = { method: '微信', cents: 15000 }
        const allocated = Math.min(remainingDay, current.cents); // 这次分配多少
        daySplits.push({ method: current.method, cents: allocated });
        current.cents -= allocated;
        remainingDay -= allocated;
      }

      byDay.set(day.stayDate, convertSplitCentsToAmount(daySplits));
    }

    const remainingSplitCents = queue.reduce((sum, item) => sum + item.cents, 0);
    if (remainingSplitCents !== 0) {
      throw createCheckInSplitError('房费拆分金额超过应收房费');
    }

    return byDay;
  }

  throw createCheckInSplitError('roomFeePaymentSplits 格式错误，应为数组');
}

/**
 * 办理入住弹窗界面中，押金 != 0 时触发，将标准化押金数组
 */
function normalizeDepositPaymentSplits(depositPaymentSplits, depositAmount, fallbackMethod) {
  const expectedCents = amountToCents(depositAmount);
  if (expectedCents <= 0) return [];

  const normalizedFallbackMethod = normalizePayWay(fallbackMethod);
  if (!depositPaymentSplits) {
    return [{ method: normalizedFallbackMethod, amount: centsToAmount(expectedCents) }];
  }
  if (!Array.isArray(depositPaymentSplits)) {
    throw createCheckInSplitError('depositPaymentSplits 格式错误，应为数组');
  }

  const parsed = parseSplitArray(depositPaymentSplits, expectedCents, '押金拆分', normalizedFallbackMethod);
  return convertSplitCentsToAmount(parsed);
}

/**
 * 多种支付方式 返回 "混合支付"
 * 单一支付方式 返回该支付方式
 */
function getRoomFeeSummaryPaymentMethod(roomFeeSplitsByDay, fallbackMethod) {
  const methods = new Set();
  for (const daySplits of roomFeeSplitsByDay.values()) {
    for (const split of daySplits || []) {
      const cents = amountToCents(split.amount);
      if (cents > 0) {
        methods.add(normalizePayWay(split.method, fallbackMethod));
      }
    }
  }
  if (methods.size > 1) return '混合支付';
  if (methods.size === 1) return [...methods][0];
  return normalizePayWay(fallbackMethod);
}

/**
 * 给创建订单页面的支付信息生成每日房价明细。
 * 支持两种方式：
 * 1. 输入基础房价：每一天使用同一个基础房价，休息房自动半价。
 * 2. 输入总房价：把总价平均拆到每一天。
 */
async function getPricingBreakdown(payload) {
  const { checkInDate, checkOutDate, mode, basePrice, totalPrice } = payload || {};

  const formattedCheckInDate = formatDate(checkInDate);
  const formattedCheckOutDate = formatDate(checkOutDate);

  let stayDates = [];
  if (!formattedCheckInDate) {
    stayDates = [];
  } else if (!formattedCheckOutDate || formattedCheckOutDate <= formattedCheckInDate) {
    // 退房日期为空或不晚于入住日期时，按单日订单处理。
    stayDates = [formattedCheckInDate];
  } else {
    stayDates = await orderCreateRepository.listStayDates(formattedCheckInDate, formattedCheckOutDate);
  }

  if (!stayDates.length) {
    const err = new Error('订单日期范围无效，无法生成定价拆分');
    err.code = 'INVALID_DATE_RANGE';
    throw err;
  }

  const restRoom = formattedCheckInDate && formattedCheckOutDate && formattedCheckInDate === formattedCheckOutDate;
  const dailyPrices = {};

  if (mode === 'from-room-price') { // 按“基础房价”生成每天同价（休息房半价）
    const base = toAmountNumber(basePrice); // 两位小数的数字
    if (!(base > 0)) {
      const err = new Error('房间基础价格无效');
      err.code = 'INVALID_PRICE';
      throw err;
    }
    const baseCents = Math.round(base * 100);
    // 休息房默认使用基础房价的一半。
    const adjustedCents = restRoom ? Math.round(baseCents / 2) : baseCents;
    stayDates.forEach(d => { dailyPrices[d] = adjustedCents / 100; });
  } else if (mode === 'distribute-total') { // 按“总价”平均分摊到每天（用“分”处理余数）
    const total = toAmountNumber(totalPrice);
    if (!(total > 0)) {
      const err = new Error('总价无效');
      err.code = 'INVALID_PRICE';
      throw err;
    }

    const totalCents = Math.round(total * 100);
    const days = stayDates.length || 1;
    const baseCents = Math.floor(totalCents / days);
    let remainder = totalCents - baseCents * days;

    stayDates.forEach((d) => {
      let cents = baseCents;
      // 总价不能整除天数时，余下的分从前往后每天补 1 分。
      if (remainder > 0) {
        cents += 1;
        remainder -= 1;
      }
      dailyPrices[d] = cents / 100;
    });
  } else {
    const err = new Error('定价拆分模式无效');
    err.code = 'INVALID_MODE';
    throw err;
  }

  const total = Object.values(dailyPrices).reduce((s, v) => s + (Number(v) || 0), 0);
  const avg = stayDates.length ? total / stayDates.length : total;

  return {
    stay_dates: stayDates,
    daily_prices: dailyPrices,
    total_price: toAmountNumber(total),
    average_price: toAmountNumber(avg),
    is_rest_room: restRoom
  };
}

/**
 * 创建订单并按住宿日期拆成每天一条订单记录。
 */
async function createOrder(orderData, client) {
  try {
    const {
      orderId, sourceNumber, orderSource, guestName, phone,
      roomType, roomNumber, checkInDate, checkOutDate, status,
      paymentMethod, roomPrice, deposit, remarks,
      isPrepaid, prepaidAmount, stayType
    } = orderData;

    const normalizedOrderSource = orderSource || 'front_desk';
    const normalizedStayType = stayType || '客房';
    const normalizedIsPrepaid = Boolean(isPrepaid);
    const normalizedPrepaidAmount = toAmountNumber(prepaidAmount || 0);

    const formattedCheckInDate = formatDate(checkInDate);
    const formattedCheckOutDate = formatDate(checkOutDate);

    // 没有外部事务时由创建订单自己管理；快速入住会传入同一个 client 共用事务。
    const manageTx = !client;
    const runner = client || await orderCreateRepository.getClient();
    try {
      if (manageTx) {
        await runner.query('BEGIN');
      }

      let stayDates = [];
      if (!formattedCheckInDate) {
        stayDates = [];
      } else if (!formattedCheckOutDate || formattedCheckOutDate <= formattedCheckInDate) {
        // 退房日期为空或不晚于入住日期时，按单日订单处理。
        stayDates = [formattedCheckInDate];
      } else {
        stayDates = await orderCreateRepository.listStayDates(
          formattedCheckInDate,
          formattedCheckOutDate,
          runner
        );
      }

      if (!stayDates.length) {
        const err = new Error('订单日期范围无效，无法创建订单');
        err.code = 'INVALID_DATE_RANGE';
        throw err;
      }

      for (let i = 0; i < stayDates.length; i++) {
        const stayDate = stayDates[i];
        const totalPrice = toAmountNumber(roomPrice?.[stayDate]);
        // 预付金额只挂在第一天，避免多日订单重复计算预付。
        const prepaidAmountForThisDay = (normalizedIsPrepaid && i === 0) ? normalizedPrepaidAmount : 0;

        await orderCreateRepository.insertOrderDay(runner, [
          orderId, sourceNumber, normalizedOrderSource, guestName, phone,
          roomType, roomNumber, formattedCheckInDate, formattedCheckOutDate, stayDate, status,
          paymentMethod, totalPrice, deposit, normalizedIsPrepaid, prepaidAmountForThisDay,
          normalizedStayType, remarks
        ]);
      }

      if (manageTx) {
        await runner.query('COMMIT');
        console.log(`✅ [createOrder] 插入成功 order_id=${orderId}, 共 ${stayDates.length} 条记录`);
      }
      return { orderId };
    } catch (txnError) {
      if (manageTx) {
        await runner.query('ROLLBACK');
      }
      throw txnError;
    } finally {
      if (manageTx) {
        runner.release();
      }
    }
  } catch (error) {
    console.error('❌ [createOrder] 失败:', error.message);
    if (!error.code && /价格|日期|电话号码|押金|房型|房间号|预订|关闭/.test(error.message)) {
      error.code = 'ORDER_VALIDATION_ERROR';
    }
    throw error;
  }
}

/**
 * 办理入住：
 * update 订单状态: pending -> checked-in;
 * update 房间状态: available -> occupied;
 * insert 账单记录: 房费 + 押金（如果有的话）
 * 支持房费和押金的拆分支付，拆分规则由前端传入，后端校验后生成对应的账单记录。
 * 由于快速入住需要在创建订单的同一个事务里办理入住，所以 checkIn 方法支持复用外部事务和数据库连接。
 */
async function checkIn(orderId, depositAmount, clientOrPaymentSplitPayload, paymentSplitPayload = {}) {
  // is pgclient?
  const hasExternalClient = clientOrPaymentSplitPayload && typeof clientOrPaymentSplitPayload.query === 'function';
  const client = hasExternalClient ? clientOrPaymentSplitPayload : undefined;
  const normalizedPaymentSplitPayload = hasExternalClient
    ? paymentSplitPayload
    : (clientOrPaymentSplitPayload || {});
  // 没有外部事务时由办理入住自己管理；快速入住会传入同一个 client 共用事务。
  const manageTx = !client;
  const runner = client || await orderCreateRepository.getClient();
  let txStarted = false;

  const createdBills = [];
  const parsedDeposit = toAmountNumber(depositAmount || 0);
  const hasDeposit = parsedDeposit > 0;

  try {
    const orderRows = await orderCreateRepository.listOrderRowsForCheckIn(runner, orderId);
    console.log('📝 [check-in] 获取订单:', orderId, orderRows.length ? '找到订单' : '订单不存在');

    if (orderRows.length === 0) {
      const err = new Error('订单不存在');
      err.statusCode = 404;
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }

    const firstOrder = orderRows[0];

    if (firstOrder.status !== 'pending') {
      const err = new Error(`订单状态为 '${firstOrder.status}'，无法办理入住，只有待入住订单可以办理`);
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_FOR_CHECK_IN';
      throw err;
    }

    console.log('✅ [check-in] 获取数据库连接成功');
    if (manageTx) {
      await runner.query('BEGIN');
      txStarted = true;
      console.log('✅ [check-in] 事务开始');
    }

    const roomFeeSplitsByDay = normalizeRoomFeePaymentSplits(
      orderRows,
      normalizedPaymentSplitPayload?.roomFeePaymentSplits,
      firstOrder.payment_method
    );
    const depositMethodFallback = normalizePayWay(
      normalizedPaymentSplitPayload?.depositPaymentMethod
        || normalizedPaymentSplitPayload?.deposit_payment_method
        || normalizedPaymentSplitPayload?.depositPayWay
        || normalizedPaymentSplitPayload?.deposit_pay_way
        || firstOrder.payment_method,
      firstOrder.payment_method
    );
    const depositSplits = normalizeDepositPaymentSplits(
      normalizedPaymentSplitPayload?.depositPaymentSplits,
      parsedDeposit,
      depositMethodFallback
    );

    const summaryPaymentMethod = getRoomFeeSummaryPaymentMethod(roomFeeSplitsByDay, firstOrder.payment_method);
    if (summaryPaymentMethod !== firstOrder.payment_method) {
      await orderCreateRepository.updateOrderPaymentMethod(runner, orderId, summaryPaymentMethod);
      console.log(`🧾 [check-in] 更新订单支付方式摘要: ${firstOrder.payment_method} -> ${summaryPaymentMethod}`);
    }

    if (hasDeposit) {
      // 押金只写在第一条订单记录上，避免多日订单重复统计押金。
      await orderCreateRepository.updateOrderDeposit(runner, firstOrder.id, parsedDeposit);
      console.log(`📝 [check-in] 更新订单 ${orderId} 押金: ${firstOrder.deposit} -> ${parsedDeposit}`);

      for (const split of depositSplits) {
        const depositBill = await billService.addBill({
          order_id: orderId,
          room_number: firstOrder.room_number,
          guest_name: firstOrder.guest_name,
          change_price: split.amount,
          change_type: '收押',
          pay_way: split.method,
          remarks: depositSplits.length > 1 ? '办理入住押金(拆分)' : '办理入住押金',
          stay_type: firstOrder.stay_type,
          stay_date: firstOrder.check_in_date
        }, runner);
        createdBills.push(depositBill);
      }
      console.log(`📝 [check-in] 插入押金账单，金额: ${parsedDeposit}`);
    }

    await orderCreateRepository.updateOrderStatus(runner, orderId, 'checked-in');
    console.log(`📝 [check-in] 更新订单 ${orderId} 状态为已入住`);

    await orderCreateRepository.updateRoomStatus(runner, firstOrder.room_number, 'occupied');
    console.log(`📝 [check-in] 更新房间 ${firstOrder.room_number} 状态为已入住`);

    for (const ord of orderRows) {
      const stayDateStr = formatDate(ord.stay_date);
      const daySplits = roomFeeSplitsByDay.get(stayDateStr) || [{
        method: normalizePayWay(ord.payment_method),
        amount: toAmountNumber(ord.total_price)
      }];
      for (const split of daySplits) { // 给某一天插入"所有"支付方式
        const roomBill = await billService.addBill({
          order_id: orderId,
          room_number: ord.room_number,
          guest_name: ord.guest_name,
          change_price: split.amount,
          change_type: '房费',
          pay_way: split.method,
          remarks: daySplits.length > 1 ? '办理入住房费(拆分)' : '办理入住房费',
          stay_type: ord.stay_type,
          stay_date: stayDateStr
        }, runner);
        createdBills.push(roomBill);
      }
      console.log(`📝 [check-in] 插入房费账单，金额: ${ord.total_price}，入住日期: ${stayDateStr}`);
    }

    if (manageTx) {
      await runner.query('COMMIT');
      console.log('✅ [check-in] 事务提交成功');
    }

    return createdBills;
  } catch (error) {
    if (manageTx && txStarted) {
      await runner.query('ROLLBACK');
      console.log('❌ [check-in] 事务回滚成功');
    }
    console.error('❌ [check-in] 办理入住失败:', error);
    throw error;
  } finally {
    if (manageTx) {
      runner.release();
      console.log('✅ [check-in] 数据库连接已释放');
    }
  }
}

/**
 * 快速入住：在同一个事务里创建订单并立即办理入住。
 */
async function fastCheckIn(orderData, createdBy = 'system') {
  try {
    console.log('🚀 [fastCheckIn] 开始快速入住流程, 操作人:', createdBy);
    console.log('🛠️ [fastCheckIn] 输入原始数据:', JSON.stringify(orderData, null, 2));

    const normalized = {
      ...orderData,
      orderId: orderData.orderId || orderData.order_id,
      sourceNumber: orderData.sourceNumber || orderData.idSource || orderData.id_source || '',
      orderSource: orderData.orderSource || orderData.order_source,
      guestName: orderData.guestName || orderData.guest_name,
      roomType: orderData.room_types || orderData.roomType || orderData.room_type,
      roomNumber: orderData.roomNumber || orderData.room_number,
      checkInDate: orderData.checkInDate || orderData.check_in_date,
      checkOutDate: orderData.checkOutDate || orderData.check_out_date,
      paymentMethod: orderData.paymentMethod || orderData.payment_method,
      roomPrice: orderData.roomPrice || orderData.total_price,
      roomFeePaymentSplits: orderData.roomFeePaymentSplits || orderData.room_fee_payment_splits,
      depositPaymentSplits: orderData.depositPaymentSplits || orderData.deposit_payment_splits,
      depositPaymentMethod: orderData.depositPaymentMethod || orderData.deposit_payment_method,
      stayType: orderData.stayType || orderData.stay_type,
      status: 'pending'
    };
    const depositAmount = toAmountNumber(orderData.deposit || 0);

    const client = await orderCreateRepository.getClient();
    try {
      await client.query('BEGIN');

      await createOrder(normalized, client);
      console.log('✅ [fastCheckIn] 订单创建成功');

      // 快速入住必须复用同一个事务，避免订单已创建但入住账单失败时留下半成品。
      await checkIn(normalized.orderId, depositAmount, client, {
        roomFeePaymentSplits: normalized.roomFeePaymentSplits,
        depositPaymentSplits: normalized.depositPaymentSplits,
        depositPaymentMethod: normalized.depositPaymentMethod
      });

      await client.query('COMMIT');

      const aggregatedOrder = await orderManageRepository.findOrderRowsByOrderId(normalized.orderId);
      const createdBills = await orderCreateRepository.listBillsByOrderId(normalized.orderId);

      return { order: aggregatedOrder, bills: createdBills };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [fastCheckIn] 快速入住失败:', error.message);
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      if (!error.code) {
        if (/价格|日期|电话号码|押金|房型|房间号|预订|关闭|重复/.test(error.message)) {
          error.code = 'VALIDATION_ERROR';
          error.statusCode = 400;
        } else {
          error.code = 'TRANSACTION_FAILED';
        }
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ [fastCheckIn] 处理失败:', error.message);
    throw error;
  }
}

module.exports = {
  checkIn,
  createOrder,
  fastCheckIn,
  getPricingBreakdown
};
