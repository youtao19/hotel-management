const billModule = require('../billModule');
const orderManageRepository = require('./orderManage.repository');
const { formatDate, toDecimal, toAmountNumber } = require('../tools');

const BASIC_UPDATE_FIELDS = ['guest_name', 'phone', 'room_type', 'payment_method', 'remarks'];
const WITH_BILLS_UPDATE_FIELDS = ['guest_name', 'phone', 'room_type', 'room_number', 'payment_method', 'remarks', 'deposit'];
const DEFAULT_PAY_WAY = '现金';
const ALLOWED_SPLIT_PAY_WAYS = new Set(['现金', '微信', '微邮付', '平台']);

function amountToCents(value) {
  return Math.round(toAmountNumber(value || 0) * 100);
}

function centsToAmount(cents) {
  return toAmountNumber((Number(cents) || 0) / 100);
}

function createPaymentSplitError(message, details = null) {
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

function parseSplitArray(rawSplits, expectedCents, label, defaultMethod) {
  if (!Array.isArray(rawSplits) || rawSplits.length === 0) {
    throw createPaymentSplitError(`${label}必须是非空数组`);
  }

  const splits = rawSplits.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw createPaymentSplitError(`${label}第 ${index + 1} 项格式不正确`);
    }
    const method = normalizePayWay(item.method || item.pay_way || item.payWay, defaultMethod);
    const amountCents = amountToCents(item.amount ?? item.change_price ?? item.changePrice);
    if (amountCents <= 0) {
      throw createPaymentSplitError(`${label}第 ${index + 1} 项金额必须大于 0`);
    }
    return { method, cents: amountCents };
  });

  const totalCents = splits.reduce((sum, split) => sum + split.cents, 0);
  if (totalCents !== expectedCents) {
    throw createPaymentSplitError(
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

function normalizeRoomFeePaymentSplits(orderRows, roomFeePaymentSplits, fallbackMethod) {
  const normalizedFallbackMethod = normalizePayWay(fallbackMethod);
  const days = orderRows.map((row) => ({
    stayDate: formatDate(row.stay_date),
    cents: amountToCents(row.total_price)
  }));
  const totalExpectedCents = days.reduce((sum, day) => sum + day.cents, 0);
  const defaultByDay = new Map(
    days.map((day) => [
      day.stayDate,
      [{ method: normalizedFallbackMethod, amount: centsToAmount(day.cents) }]
    ])
  );

  if (totalExpectedCents <= 0 || !roomFeePaymentSplits) {
    return defaultByDay;
  }

  if (!Array.isArray(roomFeePaymentSplits)) {
    throw createPaymentSplitError('roomFeePaymentSplits 格式错误，应为数组');
  }

  const parsed = parseSplitArray(roomFeePaymentSplits, totalExpectedCents, '房费拆分', normalizedFallbackMethod);
  const queue = parsed.map((item) => ({ ...item }));
  const byDay = new Map();
  let splitIndex = 0;

  for (const day of days) {
    let remainingDay = day.cents;
    const daySplits = [];

    while (remainingDay > 0) {
      while (splitIndex < queue.length && queue[splitIndex].cents <= 0) splitIndex++;
      if (splitIndex >= queue.length) {
        throw createPaymentSplitError('房费拆分金额不足，无法覆盖全部住宿日');
      }

      const current = queue[splitIndex];
      const allocated = Math.min(remainingDay, current.cents);
      daySplits.push({ method: current.method, cents: allocated });
      current.cents -= allocated;
      remainingDay -= allocated;
    }

    byDay.set(day.stayDate, convertSplitCentsToAmount(daySplits));
  }

  const remainingSplitCents = queue.reduce((sum, item) => sum + item.cents, 0);
  if (remainingSplitCents !== 0) {
    throw createPaymentSplitError('房费拆分金额超过应收房费');
  }

  return byDay;
}

function normalizeDepositPaymentSplits(depositPaymentSplits, depositAmount, fallbackMethod) {
  const expectedCents = amountToCents(depositAmount);
  if (expectedCents <= 0) return [];

  const normalizedFallbackMethod = normalizePayWay(fallbackMethod);
  if (!depositPaymentSplits) {
    return [{ method: normalizedFallbackMethod, amount: centsToAmount(expectedCents) }];
  }
  if (!Array.isArray(depositPaymentSplits)) {
    throw createPaymentSplitError('depositPaymentSplits 格式错误，应为数组');
  }

  const parsed = parseSplitArray(depositPaymentSplits, expectedCents, '押金拆分', normalizedFallbackMethod);
  return convertSplitCentsToAmount(parsed);
}

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
 * 给订单列表页读取聚合后的订单数据。
 * 列表筛选已经在 validator 中归一化，service 只负责进入 repository。
 */
async function listOrders(filters) {
  return orderManageRepository.listOrders(filters);
}

/**
 * 给每日房间安排页读取按入住日期拆开的订单明细。
 * 多日订单的分行结构由 repository 保持原查询口径。
 */
async function listDailyOrders() {
  return orderManageRepository.listDailyOrders();
}

/**
 * 给订单详情和编辑页读取单笔订单。
 * 兼容多日订单返回数组的旧接口格式。
 */
async function getOrder(orderId) {
  return orderManageRepository.findOrderRowsByOrderId(orderId);
}

/**
 * 给旧兼容出口读取单条订单日记录。
 */
async function getOrderRowById(id) {
  return orderManageRepository.findOrderRowById(id);
}

/**
 * 修改订单状态。
 * 多日订单状态需要同步到同一 order_id 下的所有日记录。
 */
async function updateOrderStatus(orderNumber, newStatus) {
  return orderManageRepository.updateOrderStatus(orderNumber, newStatus);
}

/**
 * 保存订单基础字段。
 * 只处理不增删订单日记录的基础字段；复杂房价和账单编辑走 with-bills。
 */
async function updateOrder(orderNumber, orderData = {}, changedBy = 'system') {
  const client = await orderManageRepository.getClient();

  try {
    await client.query('BEGIN');

    const dailyRows = await orderManageRepository.findOrderRowsForUpdate(client, orderNumber);
    if (dailyRows.length === 0) {
      throw new Error(`订单 ${orderNumber} 不存在`);
    }

    const oldOrder = dailyRows[0];
    const fieldsToUpdate = {};
    const changes = {};
    let paymentMethodUpdated = false;
    let newPaymentMethod = null;

    if (orderData.check_in_date !== undefined || orderData.check_out_date !== undefined) {
      console.warn('⚠️ [updateOrder] 日期变更在多日分行结构下需要使用专门的函数处理');

      const newCheckInDate = orderData.check_in_date || oldOrder.check_in_date;
      const newCheckOutDate = orderData.check_out_date || dailyRows[dailyRows.length - 1].check_out_date;
      const newStayType = formatDate(newCheckInDate) === formatDate(newCheckOutDate) ? '休息房' : '客房';

      if (newStayType !== oldOrder.stay_type) {
        console.log(`🏠 [updateOrder] 重新计算住宿类型: ${oldOrder.stay_type} -> ${newStayType} (基于日期: ${newCheckInDate} -> ${newCheckOutDate})`);
        fieldsToUpdate.stay_type = newStayType;
        changes.stay_type = {
          old: oldOrder.stay_type,
          new: newStayType
        };
      }
    }

    for (const field of BASIC_UPDATE_FIELDS) {
      if (orderData[field] !== undefined) {
        const nextValue = orderData[field];
        fieldsToUpdate[field] = nextValue;
        changes[field] = {
          old: oldOrder[field],
          new: nextValue
        };

        if (field === 'payment_method' && nextValue !== oldOrder[field]) {
          paymentMethodUpdated = true;
          newPaymentMethod = nextValue;
        }
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      await client.query('ROLLBACK');
      return { message: '没有字段需要更新' };
    }

    await orderManageRepository.updateOrderFields(client, orderNumber, fieldsToUpdate);

    if (paymentMethodUpdated) {
      const { rowCount: syncedCount } = await orderManageRepository.updateRoomFeeBillsPaymentMethod(
        client,
        orderNumber,
        newPaymentMethod
      );
      if (syncedCount > 0) {
        console.log(`🧾 [updateOrder] 同步更新 ${syncedCount} 条房费账单支付方式 -> ${newPaymentMethod}`);
      } else {
        console.log('ℹ️ [updateOrder] 未找到需要同步支付方式的房费账单');
      }
    }

    await client.query('COMMIT');

    try {
      await orderManageRepository.insertOrderChangeLog(
        orderNumber,
        changedBy,
        changes,
        orderData.reason || '订单信息更新'
      );
      console.log(`📝 [updateOrder] 变更记录已保存到 order_changes 表`);
    } catch (changeLogError) {
      console.warn(`⚠️ [updateOrder] 保存变更记录失败，但订单更新成功:`, changeLogError.message);
    }

    return orderManageRepository.findOrderRowsByOrderId(orderNumber);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('更新订单失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 修改订单某一天的房间号。
 * 订单行、账单房间号必须在同一个事务里更新，变更记录失败不影响换房结果。
 */
async function updateOrderDayRoom(orderNumber, stayDate, newRoomNumber, user) {
  const changedBy = user?.username || 'system';
  const client = await orderManageRepository.getClient();

  try {
    await client.query('BEGIN');

    const oldRow = await orderManageRepository.findOrderRowForDayRoomChange(client, orderNumber, stayDate);
    if (!oldRow) {
      throw new Error(`订单 ${orderNumber} 在 ${stayDate} 没有记录`);
    }

    const conflict = await orderManageRepository.findActiveRoomConflict(client, newRoomNumber, stayDate, orderNumber);
    if (conflict) {
      throw new Error(`房间 ${newRoomNumber} 在 ${stayDate} 已被订单 ${conflict.order_id} (${conflict.guest_name}) 占用`);
    }

    const room = await orderManageRepository.findRoomByNumber(client, newRoomNumber);
    if (!room) {
      throw new Error(`房间 ${newRoomNumber} 不存在`);
    }

    const updatedRow = await orderManageRepository.updateOrderDayRoom(
      client,
      orderNumber,
      stayDate,
      newRoomNumber,
      room.type_code
    );

    const formattedStayDate = typeof stayDate === 'string' ? stayDate.slice(0, 10) : stayDate;
    console.log(`📝 [updateOrderDayRoom] 准备更新账单，订单号: ${orderNumber}, 日期: ${formattedStayDate}, 新房间号: ${newRoomNumber}`);

    const billUpdateResult = await orderManageRepository.updateRoomFeeBillRoomNumber(
      client,
      orderNumber,
      formattedStayDate,
      newRoomNumber
    );

    if (billUpdateResult.rowCount > 0) {
      console.log(`📝 [updateOrderDayRoom] 同步更新了 ${billUpdateResult.rowCount} 条账单房间号`);
    } else {
      console.warn(`⚠️ [updateOrderDayRoom] 未找到 ${orderNumber} 在 ${formattedStayDate} 的房费账单，请检查账单数据`);
    }

    await client.query('COMMIT');

    try {
      await orderManageRepository.insertDayRoomChangeLog(
        orderNumber,
        changedBy,
        oldRow.room_number,
        newRoomNumber,
        stayDate
      );
      console.log(`📝 [updateOrderDayRoom] 变更记录已保存`);
    } catch (changeLogError) {
      console.warn(`⚠️ [updateOrderDayRoom] 保存变更记录失败:`, changeLogError.message);
    }

    console.log(`✅ [updateOrderDayRoom] 订单 ${orderNumber} 的 ${stayDate} 房间已从 ${oldRow.room_number} 更换为 ${newRoomNumber}`);
    return updatedRow;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('更新订单日期房间失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 同时修改订单、每日房价和相关账单。
 * 后端统一处理房费/押金拆分，避免前端直接决定账单结构。
 */
async function updateOrderWithBills(orderNumber, body = {}) {
  const {
    orderData,
    roomPrice,
    changedBy,
    roomFeePaymentSplits,
    depositPaymentSplits,
    depositPaymentMethod
  } = body;
  const changedByValue = changedBy || 'system';
  const normalizedOrderData = orderData && typeof orderData === 'object' ? orderData : {};
  const normalizedRoomPrice = roomPrice && typeof roomPrice === 'object' ? roomPrice : {};
  const normalizedPaymentSplitPayload = {
    roomFeePaymentSplits,
    depositPaymentSplits,
    depositPaymentMethod
  };
  const roomFeeSplitInput = roomFeePaymentSplits;
  const depositSplitInput = depositPaymentSplits;
  const depositMethodInput = depositPaymentMethod;
  const hasRoomFeeSplitPayload = roomFeeSplitInput !== undefined;
  const shouldSyncDepositSplits = (
    normalizedOrderData.deposit !== undefined
    || depositSplitInput !== undefined
    || depositMethodInput !== undefined
  );
  const client = await orderManageRepository.getClient();

  const syncSplitBills = async ({
    existingBills,
    desiredSplits,
    changeType,
    baseRow,
    stayDate,
    singleRemark,
    splitRemark
  }) => {
    const rows = Array.isArray(existingBills) ? existingBills : [];
    const splits = Array.isArray(desiredSplits) ? desiredSplits : [];
    const remark = splits.length > 1 ? splitRemark : singleRemark;
    const normalizedStayDate = formatDate(stayDate);
    const normalizedRoomNumber = normalizedOrderData.room_number || baseRow?.room_number || null;
    const normalizedGuestName = normalizedOrderData.guest_name || baseRow?.guest_name || null;
    const normalizedStayType = baseRow?.stay_type || null;
    let updated = 0;
    let inserted = 0;
    let deleted = 0;

    // 复用旧 bill_id，避免账单拆分编辑后历史引用漂移。
    for (let i = 0; i < splits.length && i < rows.length; i++) {
      const split = splits[i];
      await orderManageRepository.updateSplitBill(client, rows[i].bill_id, {
        amount: Math.abs(toAmountNumber(split.amount)),
        payWay: normalizePayWay(split.method, DEFAULT_PAY_WAY),
        roomNumber: normalizedRoomNumber,
        guestName: normalizedGuestName,
        stayType: normalizedStayType,
        remarks: remark,
        stayDate: normalizedStayDate
      });
      updated++;
    }

    for (let i = rows.length; i < splits.length; i++) {
      const split = splits[i];
      await orderManageRepository.insertBillInTransaction(client, {
        orderNumber,
        roomNumber: normalizedRoomNumber,
        guestName: normalizedGuestName,
        amount: Math.abs(toAmountNumber(split.amount)),
        changeType,
        payWay: normalizePayWay(split.method, DEFAULT_PAY_WAY),
        remarks: remark,
        stayType: normalizedStayType,
        stayDate: normalizedStayDate
      });
      inserted++;
    }

    if (rows.length > splits.length) {
      const deleteIds = rows.slice(splits.length).map((row) => Number(row.bill_id)).filter((id) => Number.isFinite(id));
      if (deleteIds.length) {
        await orderManageRepository.deleteBillsByIds(client, deleteIds);
        deleted = deleteIds.length;
      }
    }

    return { updated, inserted, deleted };
  };

  try {
    await client.query('BEGIN');

    const orderRows = await orderManageRepository.findOrderRowsForUpdateWithBills(client, orderNumber);
    if (!orderRows.length) {
      const err = new Error(`订单 ${orderNumber} 不存在`);
      err.code = 'ORDER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const fieldsToUpdate = {};
    for (const field of WITH_BILLS_UPDATE_FIELDS) {
      if (normalizedOrderData[field] !== undefined) {
        fieldsToUpdate[field] = field === 'deposit'
          ? toAmountNumber(normalizedOrderData[field])
          : normalizedOrderData[field];
      }
    }
    if (Object.keys(fieldsToUpdate).length) {
      await orderManageRepository.updateOrderFields(client, orderNumber, fieldsToUpdate);
    }

    const billUpdateResults = [];
    for (const [stayDateRaw, priceRaw] of Object.entries(normalizedRoomPrice || {})) {
      const stayDate = formatDate(stayDateRaw);
      const price = toAmountNumber(priceRaw);
      const result = await orderManageRepository.updateDailyRoomPrice(client, orderNumber, stayDate, price);
      billUpdateResults.push({ stayDate, ...result });
    }

    const latestOrderRows = await orderManageRepository.findOrderRowsInTransaction(client, orderNumber);
    const firstOrderRow = latestOrderRows[0];

    if (hasRoomFeeSplitPayload) {
      const roomFeeFallbackMethod = normalizePayWay(
        normalizedOrderData.payment_method || firstOrderRow?.payment_method,
        firstOrderRow?.payment_method || DEFAULT_PAY_WAY
      );
      const roomFeeSplitsByDay = normalizeRoomFeePaymentSplits(
        latestOrderRows,
        roomFeeSplitInput,
        roomFeeFallbackMethod
      );

      for (const row of latestOrderRows) {
        const stayDate = formatDate(row.stay_date);
        const desiredSplits = roomFeeSplitsByDay.get(stayDate) || [];
        const existingBills = await orderManageRepository.findBillsForSplitUpdate(
          client,
          orderNumber,
          '房费',
          stayDate
        );
        const syncResult = await syncSplitBills({
          existingBills,
          desiredSplits,
          changeType: '房费',
          baseRow: row,
          stayDate,
          singleRemark: '修改订单房费',
          splitRemark: '修改订单房费(拆分)'
        });
        billUpdateResults.push({
          stayDate,
          orderUpdated: 1,
          billUpdated: syncResult.updated + syncResult.inserted,
          billDeleted: syncResult.deleted
        });
      }

      const summaryPaymentMethod = getRoomFeeSummaryPaymentMethod(roomFeeSplitsByDay, roomFeeFallbackMethod);
      await orderManageRepository.updateOrderPaymentMethodInTransaction(client, orderNumber, summaryPaymentMethod);
      normalizedOrderData.payment_method = summaryPaymentMethod;
    }

    if (shouldSyncDepositSplits) {
      const currentDeposit = normalizedOrderData.deposit !== undefined
        ? toAmountNumber(normalizedOrderData.deposit)
        : toAmountNumber(firstOrderRow?.deposit || 0);
      const depositFallbackMethod = normalizePayWay(
        depositMethodInput || normalizedOrderData.payment_method || firstOrderRow?.payment_method,
        firstOrderRow?.payment_method || DEFAULT_PAY_WAY
      );
      const desiredDepositSplits = normalizeDepositPaymentSplits(
        depositSplitInput,
        currentDeposit,
        depositFallbackMethod
      );
      const existingDepositBills = await orderManageRepository.findBillsForSplitUpdate(
        client,
        orderNumber,
        '收押'
      );
      const syncResult = await syncSplitBills({
        existingBills: existingDepositBills,
        desiredSplits: desiredDepositSplits,
        changeType: '收押',
        baseRow: firstOrderRow,
        stayDate: firstOrderRow?.check_in_date,
        singleRemark: '修改订单押金',
        splitRemark: '修改订单押金(拆分)'
      });
      billUpdateResults.push({
        stayDate: formatDate(firstOrderRow?.check_in_date),
        orderUpdated: 1,
        billUpdated: syncResult.updated + syncResult.inserted,
        billDeleted: syncResult.deleted,
        changeType: '收押'
      });
    }

    if (normalizedOrderData.room_number !== undefined) {
      await orderManageRepository.updateAllBillRoomNumbers(client, orderNumber, normalizedOrderData.room_number);
    }

    if (!hasRoomFeeSplitPayload && normalizedOrderData.payment_method !== undefined) {
      const paywayCount = await orderManageRepository.countRoomFeeBillPaymentWays(client, orderNumber);
      if (paywayCount <= 1) {
        await orderManageRepository.updateRoomFeeBillsPaymentMethod(client, orderNumber, normalizedOrderData.payment_method);
      } else {
        console.log(`ℹ️ [updateOrderWithBills] 订单 ${orderNumber} 存在混合支付房费账单，跳过 pay_way 同步`);
      }
    }

    await client.query('COMMIT');

    try {
      await orderManageRepository.insertOrderChangeLog(
        orderNumber,
        changedByValue,
        {
          action: 'update_order_with_bills',
          order_fields: normalizedOrderData,
          room_price: normalizedRoomPrice,
          payment_splits: normalizedPaymentSplitPayload,
          bill_updates: billUpdateResults
        },
        normalizedOrderData.reason || '订单信息更新（含房费/账单同步）'
      );
    } catch (e) {
      console.warn('⚠️ [updateOrderWithBills] 保存变更记录失败:', e.message);
    }

    return {
      success: true,
      order: await orderManageRepository.findOrderRowsByOrderId(orderNumber),
      billUpdates: billUpdateResults,
      message: '订单和账单更新成功'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ [updateOrderWithBills] 更新订单 ${orderNumber} 和账单失败:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 给提前退房弹窗读取建议退款信息。
 * 推荐金额按订单日记录计算，前端只展示结果和后端校验状态。
 */
async function getEarlyCheckoutRecommendation(orderNumber, query = {}) {
  const { actualCheckoutTime, hasStayed } = query;
  const hasStayedFlag = !(hasStayed === false || hasStayed === 'false');
  const actualCheckoutDateStr = hasStayedFlag ? formatDate(actualCheckoutTime) : null;
  if (hasStayedFlag && !actualCheckoutDateStr) {
    const err = new Error('缺少实际退房时间');
    err.code = 'EARLY_CHECKOUT_MISSING_TIME';
    err.statusCode = 400;
    throw err;
  }

  const orderRows = await orderManageRepository.findOrderRowsByOrderId(orderNumber);
  if (!orderRows) {
    const err = new Error(`订单 ${orderNumber} 不存在`);
    err.code = 'ORDER_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const lastRow = orderRows[orderRows.length - 1];
  const originalCheckOutTime = formatDate(lastRow?.check_out_date);
  const canEarlyCheckout = !hasStayedFlag || (actualCheckoutDateStr < originalCheckOutTime);
  const validationMessage = canEarlyCheckout ? '' : '实际退房日期未早于原退房日期，无法执行提前退房';

  const candidateRows = hasStayedFlag
    ? orderRows.filter((row) => {
      const stayDate = formatDate(row.stay_date);
      return Boolean(stayDate && stayDate >= actualCheckoutDateStr);
    })
    : orderRows;

  const refundableNights = candidateRows.map((row) => ({
    stayDate: formatDate(row.stay_date),
    roomPrice: toAmountNumber(row.total_price)
  }));
  const recommendedRefund = toAmountNumber(
    refundableNights.reduce((sum, item) => sum.plus(item.roomPrice), toDecimal(0))
  );

  return {
    recommendedRefund,
    refundableNights,
    originalCheckOutTime,
    actualCheckoutDate: actualCheckoutDateStr || '',
    validation: {
      canEarlyCheckout,
      code: canEarlyCheckout ? 'OK' : 'NOT_EARLY',
      message: validationMessage
    }
  };
}

/**
 * 办理提前退房。
 * operator 优先于登录用户，用于保留前台手动指定操作人的旧接口行为。
 */
async function earlyCheckout(orderNumber, body = {}, user) {
  const { actualCheckoutTime, refundAmount, refundMethod, operator, remarks, hasStayed } = body;
  const changedBy = operator || user?.username || 'system';
  const client = await orderManageRepository.getClient();

  try {
    await client.query('BEGIN');

    const orderRows = await orderManageRepository.findOrderRowsForEarlyCheckout(client, orderNumber);
    if (orderRows.length === 0) {
      const err = new Error(`订单 ${orderNumber} 不存在`);
      err.code = 'ORDER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const firstRow = orderRows[0];
    const lastRow = orderRows[orderRows.length - 1];

    if (!['checked-in', 'occupied'].includes(firstRow.status)) {
      const err = new Error(`订单状态为 '${firstRow.status}'，无法提前退房`);
      err.code = 'EARLY_CHECKOUT_INVALID_STATE';
      err.statusCode = 400;
      throw err;
    }

    const hasStayedFlag = !(hasStayed === false || hasStayed === 'false');
    const originalCheckoutDateStr = formatDate(lastRow.check_out_date);
    const actualCheckoutDateStr = formatDate(actualCheckoutTime);
    const checkInDateStr = formatDate(firstRow.check_in_date);

    if (!actualCheckoutDateStr) {
      const err = new Error('缺少实际退房时间');
      err.code = 'EARLY_CHECKOUT_MISSING_TIME';
      err.statusCode = 400;
      throw err;
    }

    const originalTotalPrice = orderRows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);

    if (actualCheckoutDateStr === checkInDateStr || !hasStayedFlag) {
      let parsedRefund = refundAmount !== undefined && refundAmount !== null && refundAmount !== ''
        ? Number(refundAmount)
        : null;

      if (parsedRefund === null || Number.isNaN(parsedRefund)) {
        const netPaid = await orderManageRepository.getOrderBillNetPaid(client, orderNumber);
        const depositFallback = orderRows.reduce((sum, row) => sum + Number(row.deposit || 0), 0);

        parsedRefund = Math.max(0, Number(netPaid.toFixed(2)));
        if (parsedRefund === 0 && depositFallback > 0) {
          parsedRefund = depositFallback;
        }
        if (parsedRefund === 0 && originalTotalPrice > 0) {
          parsedRefund = originalTotalPrice;
        }
      }

      if (!Number.isFinite(parsedRefund) || parsedRefund < 0) {
        const err = new Error('退房退款金额无效');
        err.code = 'EARLY_CHECKOUT_INVALID_REFUND';
        err.statusCode = 400;
        throw err;
      }

      const finalRefund = Number(parsedRefund.toFixed(2));
      const refundPayWay = refundMethod || firstRow.payment_method || '现金';

      await orderManageRepository.cancelOrderAfterCheckin(client, orderNumber, actualCheckoutDateStr);

      let refundBillRow = null;
      if (finalRefund > 0) {
        refundBillRow = await orderManageRepository.insertEarlyCheckoutRefundBill(client, {
          orderNumber,
          roomNumber: String(firstRow.room_number || '').slice(0, 10),
          guestName: firstRow.guest_name,
          amount: Number((-finalRefund).toFixed(2)),
          changeType: '退款',
          payWay: refundPayWay,
          remarks: remarks || '未入住退房退款',
          stayType: firstRow.stay_type,
          stayDate: actualCheckoutDateStr
        });
      }

      await orderManageRepository.markRoomAvailable(client, firstRow.room_number);
      await client.query('COMMIT');

      const changeDetails = {
        action: 'cancel_after_checkin',
        has_stayed: false,
        previous_status: firstRow.status,
        new_status: 'cancelled',
        actual_checkout_date: actualCheckoutDateStr,
        refund_amount: finalRefund,
        refund_method: refundPayWay,
        previous_total_price: originalTotalPrice,
        new_total_price: 0,
        affected_rows: orderRows.length
      };

      try {
        await orderManageRepository.insertOrderChangeLog(
          orderNumber,
          changedBy,
          changeDetails,
          remarks || '未入住退房办理'
        );
        console.log(`📝 [earlyCheckout] 未入住退房变更记录已保存`);
      } catch (logError) {
        console.warn(`⚠️ [earlyCheckout] 保存变更记录失败:`, logError.message);
      }

      return {
        success: true,
        order: await orderManageRepository.findOrderRowsByOrderId(orderNumber),
        refund: {
          actual: finalRefund,
          method: refundPayWay,
          bill: refundBillRow
        },
        refundedStayDates: [],
        cancelled: true
      };
    }

    if (!(actualCheckoutDateStr < originalCheckoutDateStr)) {
      const err = new Error('实际退房日期未早于原退房日期，无法执行提前退房');
      err.code = 'EARLY_CHECKOUT_NOT_EARLY';
      err.statusCode = 400;
      throw err;
    }

    const refundableRows = orderRows.filter((row) => {
      const stayDateStr = formatDate(row.stay_date);
      return stayDateStr && stayDateStr >= actualCheckoutDateStr;
    });
    const recommendedRefund = Number(refundableRows
      .reduce((sum, row) => sum + Number(row.total_price || 0), 0)
      .toFixed(2));
    const parsedRefund = refundAmount !== undefined && refundAmount !== null && refundAmount !== ''
      ? Number(refundAmount)
      : recommendedRefund;

    if (!Number.isFinite(parsedRefund) || parsedRefund < 0) {
      const err = new Error('退房退款金额无效');
      err.code = 'EARLY_CHECKOUT_INVALID_REFUND';
      err.statusCode = 400;
      throw err;
    }

    if (parsedRefund - recommendedRefund > 0.01) {
      const err = new Error('退款金额不能超过可退房费');
      err.code = 'EARLY_CHECKOUT_REFUND_TOO_HIGH';
      err.statusCode = 400;
      throw err;
    }

    const finalRefund = Number(parsedRefund.toFixed(2));
    const refundPayWay = refundMethod || firstRow.payment_method || '现金';
    const updatedTotalPrice = Math.max(0, Number((originalTotalPrice - finalRefund).toFixed(2)));

    await orderManageRepository.updateOrderEarlyCheckout(client, orderNumber, actualCheckoutDateStr);
    await orderManageRepository.deleteUnstayedOrderRows(client, orderNumber, actualCheckoutDateStr);

    let refundBillRow = null;
    if (finalRefund > 0) {
      refundBillRow = await orderManageRepository.insertEarlyCheckoutRefundBill(client, {
        orderNumber,
        roomNumber: String(firstRow.room_number || '').slice(0, 10),
        guestName: firstRow.guest_name,
        amount: Number((-finalRefund).toFixed(2)),
        changeType: '房费',
        payWay: refundPayWay,
        remarks: remarks || `提前退房退款（原退房日: ${originalCheckoutDateStr}）`,
        stayType: firstRow.stay_type,
        stayDate: actualCheckoutDateStr
      });
    }

    await orderManageRepository.markRoomCleaning(client, firstRow.room_number);
    await client.query('COMMIT');

    const refundedStayDates = refundableRows.map(row => formatDate(row.stay_date));
    const changeDetails = {
      action: 'early_checkout',
      previous_check_out_date: originalCheckoutDateStr,
      new_check_out_date: actualCheckoutDateStr,
      previous_status: firstRow.status,
      new_status: 'checked-out',
      recommended_refund: recommendedRefund,
      actual_refund: finalRefund,
      refund_method: refundPayWay,
      refunded_stay_dates: refundedStayDates,
      total_price: {
        old: originalTotalPrice,
        new: updatedTotalPrice
      }
    };

    try {
      await orderManageRepository.insertOrderChangeLog(
        orderNumber,
        changedBy,
        changeDetails,
        remarks || '提前退房办理'
      );
      console.log(`📝 [earlyCheckout] 变更记录已保存`);
    } catch (logError) {
      console.warn(`⚠️ [earlyCheckout] 保存变更记录失败:`, logError.message);
    }

    return {
      success: true,
      order: await orderManageRepository.findOrderRowsByOrderId(orderNumber),
      refund: {
        recommended: recommendedRefund,
        actual: finalRefund,
        method: refundPayWay,
        bill: refundBillRow
      },
      refundedStayDates
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ [earlyCheckout] 提前退房失败:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 办理订单退押金。
 * 退押账单继续交给 billModule 写入，保证账单金额转负数规则不变。
 */
async function refundDeposit(refundData) {
  console.log('处理退押金请求:', refundData);

  const orderRows = await orderManageRepository.findOrderRowsByOrderId(refundData.order_id);
  console.log('关联订单信息:', orderRows);

  if (!orderRows) {
    console.log('！！！！获取订单失败');
    throw new Error(`订单号 '${refundData.order_id}' 不存在`);
  }

  if (refundData.change_price > orderRows[0].deposit) {
    throw new Error('退押金额不能超过订单押金');
  }

  const allowedStatuses = ['checked-out', 'cancelled'];
  if (!orderRows.every(row => allowedStatuses.includes(row.status))) {
    throw new Error('只有已退房或已取消的订单才能退押金');
  }

  const changePrice = -Math.abs(refundData.change_price || 0);
  const billData = {
    ...refundData,
    change_type: '退押',
    change_price: changePrice,
    room_number: orderRows[0].room_number,
    guest_name: orderRows[0].guest_name,
    remarks: refundData.remarks || '订单退押',
    stay_type: orderRows[0].stay_type,
    stay_date: orderRows[0].check_out_date
  };
  console.log('准备创建退押金账单，数据如下:', billData);

  const bill = await billModule.addBill(billData);
  if (!bill) {
    throw new Error('创建账单失败');
  }

  return bill;
}

/**
 * 给押金弹窗读取当前可退押金。
 * 继续使用账单统计口径，避免只看 orders.deposit 导致多次退押不一致。
 */
async function getDepositInfo(orderId) {
  return orderManageRepository.getDepositInfo(orderId);
}

/**
 * 办理正常退房。
 * 订单状态和房态必须在同一个事务里变更，避免退房成功但房态未进入清洁中。
 */
async function checkOut(orderId, client) {
  const manageTx = !client;
  const runner = client || await orderManageRepository.getClient();
  let txStarted = false;

  try {
    console.log(`🚪 [checkOut] 办理退房，订单号: ${orderId}, 管理事务: ${manageTx}`);

    if (manageTx) {
      await runner.query('BEGIN');
      txStarted = true;
    }

    await orderManageRepository.updateOrderStatusInTransaction(runner, orderId, 'checked-out');
    console.log(`✅ [checkOut] 订单 ${orderId} 状态更新为已退房`);

    const orderRows = await orderManageRepository.findOrderRowsForCheckout(runner, orderId);
    for (const orderRow of orderRows) {
      await orderManageRepository.markRoomCleaning(runner, orderRow.room_number);
    }

    if (manageTx) {
      await runner.query('COMMIT');
    }

    return orderManageRepository.findOrderRowsByOrderId(orderId);
  } catch (error) {
    if (manageTx && txStarted) {
      await runner.query('ROLLBACK');
      console.log('❌ [checkOut] 事务回滚成功');
    }
    console.error('❌ [checkOut] 办理退房失败:', error);
    throw error;
  } finally {
    if (manageTx) {
      runner.release();
    }
  }
}

module.exports = {
  checkOut,
  earlyCheckout,
  getDepositInfo,
  getEarlyCheckoutRecommendation,
  getOrder,
  getOrderRowById,
  listDailyOrders,
  listOrders,
  refundDeposit,
  updateOrder,
  updateOrderDayRoom,
  updateOrderStatus,
  updateOrderWithBills
};
