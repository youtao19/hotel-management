const { query, getClient } = require('../database/postgreDB/pg');
const billModule = require('./billModule');
const setup = require('../appSettings/setup');
const { formatDate, formatDateTimeForDB } = require('./tools');
const { toDecimal, toAmountNumber } = require('./tools');

const tableName = "orders";

// 定义有效的订单状态
const VALID_ORDER_STATES = ['pending', 'reserved', 'checked-in', 'checked-out', 'occupied', 'cancelled'];

/**
 * 检查orders表是否存在
 * @returns {Promise<Object>} 返回检查结果
 */
async function checkTableExists() {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '${tableName}'
      );
    `);
    return result;
  } catch (error) {
    console.error('检查表是否存在失败:', error);
    throw error;
  }
}

/**
 * 检查是否为休息房（入住和退房是同一天）
 * @param {Object} orderData 订单数据
 * @returns {boolean} 是否为休息房
 */
function isRestRoom(orderData) {
  const toLocalYMD = (d) => {
    if (d == null) return '';
    if (typeof d === 'string') return d.slice(0, 10); // 已经是 'YYYY-MM-DD'
    const dt = (d instanceof Date) ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const checkInDateStr = toLocalYMD(orderData.check_in_date);
  const checkOutDateStr = toLocalYMD(orderData.check_out_date);
  return checkInDateStr === checkOutDateStr;
}



/**
 * 创建新订单 - 支持多日分行插入
 * 多日预订会拆分为多条记录，每条记录对应一个 stay_date
 * @param {Object} orderData 订单数据
 * @returns {Promise<Object>} 创建的订单（返回第一行，包含汇总信息）
 */
async function createOrder(orderData, client) {
  try {
    //  解构订单数据
    const {
      orderId, sourceNumber, orderSource, guestName, phone,
      roomType, roomNumber, checkInDate, checkOutDate, status,
      paymentMethod, roomPrice, deposit, createTime, remarks,
      isPrepaid, prepaidAmount, stayType
    } = orderData;

    const normalizedOrderSource = orderSource || orderData.order_source || 'front_desk';
    const normalizedStayType = stayType || orderData.stay_type || '客房';
    const normalizedIsPrepaid = Boolean(isPrepaid);
    const normalizedPrepaidAmount = toAmountNumber(prepaidAmount || 0);
    const normalizedCreateTime = formatDateTimeForDB(createTime || new Date());

    const formattedCheckInDate = formatDate(checkInDate);
    const formattedCheckOutDate = formatDate(checkOutDate);
    // 计算住宿天数
    const checkInDateObj = new Date(formattedCheckInDate);
    const checkOutDateObj = new Date(formattedCheckOutDate);
    let stayDays = Math.ceil((checkOutDateObj - checkInDateObj) / (1000 * 60 * 60 * 24));
    // 休息房（同日入住退房）按1天处理
    if (stayDays === 0) stayDays = 1;

    // 插入 sql 语句
    const insertQuery = `
      INSERT INTO orders (
        order_id, id_source, order_source, guest_name, phone,
        room_type, room_number, check_in_date, check_out_date, stay_date, status,
        payment_method, total_price, deposit, is_prepaid, prepaid_amount,
        create_time, stay_type, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING *;
    `;

    const manageTx = !client;
    const runner = client || await getClient();
    try {
      if (manageTx) {
        await runner.query('BEGIN');
      }

      // 获得日期列表
      const dateList = Object.keys(roomPrice);
      for (let i = 0; i < stayDays; i++) {
        const stay_date = formatDate(dateList[i] || new Date(checkInDateObj.getTime() + i * 24 * 60 * 60 * 1000));
        const total_price = toAmountNumber(roomPrice[stay_date]);

        // 如果是预付，预付金额放在第一天的订单
        let prepaidAmountForThisDay = 0;
        if (normalizedIsPrepaid) {
          prepaidAmountForThisDay = (i === 0) ? normalizedPrepaidAmount : 0;
        }

        let value = [orderId, sourceNumber, normalizedOrderSource, guestName, phone,
          roomType, roomNumber, checkInDate, checkOutDate, stay_date, status,
          paymentMethod, total_price, deposit, normalizedIsPrepaid, prepaidAmountForThisDay || normalizedPrepaidAmount,
          normalizedCreateTime, normalizedStayType, remarks]
        await runner.query(insertQuery, value);
      }

      if (manageTx) {
        await runner.query('COMMIT');
        console.log(`✅ [createOrder] 插入成功 order_id=${orderId}, 共 ${stayDays} 条记录`);
      }
      return;
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
    if (!error.code) {
      if (/价格|日期|电话号码|押金|房型|房间号|预订|关闭/.test(error.message)) {
        error.code = 'ORDER_VALIDATION_ERROR';
      }
    }
    throw error;
  }
}

/**
 * 获取所有订单（聚合视图）
 * 在多日分行结构中，按 order_id 聚合，返回订单汇总信息
 * @returns {Promise<Array>} 所有订单列表（聚合后）
 */
async function getAllOrders() {
  try {
    // 聚合查询：按 order_id 分组，计算总价和住宿天数
    const result = await query(`
      SELECT
        order_id,
        MAX(id_source) as id_source,
        MAX(order_source) as order_source,
        MAX(guest_name) as guest_name,
        MAX(phone) as phone,
        MAX(room_type) as room_type,
        MAX(room_number) as room_number,
        MIN(check_in_date) as check_in_date,
        MAX(check_out_date) as check_out_date,
        MAX(status) as status,
        MAX(payment_method) as payment_method,
        SUM(total_price) as total_price,
        SUM(deposit) as deposit,
        BOOL_OR(is_prepaid) as is_prepaid,
        SUM(prepaid_amount) as prepaid_amount,
        MIN(create_time) as create_time,
        MAX(stay_type) as stay_type,
        MAX(remarks) as remarks,
        COUNT(*) as stay_days,
        ARRAY_AGG(stay_date ORDER BY stay_date) as stay_dates
      FROM orders
      GROUP BY order_id
      ORDER BY MIN(create_time) DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('获取所有订单失败:', error);
    throw error;
  }
}

/**
 * 获取所有订单的每日明细（原始行）
 * @returns {Promise<Array>} 所有订单每日明细
 */
async function getAllOrdersDaily() {
  try {
    const result = await query('SELECT * FROM orders ORDER BY order_id, stay_date');
    return result.rows;
  } catch (error) {
    console.error('获取所有订单每日明细失败:', error);
    throw error;
  }
}

/**
 * 根据 order_id 获取订单（聚合视图）
 * @param {string} orderId - 订单ID
 * @returns {Array} 订单数组（含每日明细）或null
 */
async function getOrderById(orderId) {
  try {
    // 先获取所有每日记录
    const dailyResult = await query('SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date', [orderId]);

    if (dailyResult.rows.length === 0) {
      return null;
    }
    return dailyResult.rows;
  } catch (error) {
    console.error(`获取订单(ID: ${orderId})失败:`, error);
    throw error;
  }
}

/**
 * 根据 id（主键）获取单日订单记录
 * @param {number} id - 主键ID
 * @returns {Promise<Object|null>} 单日订单记录或null
 */
async function getOrderRowById(id) {
  try {
    const result = await query('SELECT * FROM orders WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error(`获取订单记录(id: ${id})失败:`, error);
    throw error;
  }
}

/**
 * 更新订单状态（更新所有关联的每日记录）
 * @param {string} orderId - 订单ID
 * @param {string} newStatus - 新状态
 * @returns {Promise<Object|null>} 更新后的第一条订单记录或null
 */
async function updateOrderStatus(orderId, newStatus, client) {
  try {
    const updateQuery = `UPDATE ${tableName} SET status = $1 WHERE order_id = $2 RETURNING *`;
    const queryParams = [newStatus, orderId];
    let result;
    if (!client) {
      result = await query(updateQuery, queryParams);
    } else {
      result = await client.query(updateQuery, queryParams);
    }
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error(`更新订单(ID: ${orderId})状态为 '${newStatus}' 失败:`, error);
    throw error;
  }
}

/**
 * 更新订单（更新所有关联的每日记录）
 * @param {string} orderNumber - 订单号 (order_id)
 * @param {Object} updatedData - 需要更新的字段
 * @param {string} changedBy - 操作人
 * @returns {Promise<Object>} 更新后的订单对象（聚合视图）
 */
async function updateOrder(orderNumber, updatedData, changedBy = 'system') {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 获取该订单的所有每日记录
    const { rows: dailyRows } = await client.query(
      `SELECT * FROM ${tableName} WHERE order_id = $1 ORDER BY stay_date`,
      [orderNumber]
    );

    if (dailyRows.length === 0) {
      throw new Error(`订单 ${orderNumber} 不存在`);
    }

    const oldOrder = dailyRows[0]; // 使用第一条记录作为参考

    // 构建更新字段部分
    const updates = [];
    const values = [];
    const changes = {}; // 记录变更
    let paramIndex = 1;
    let paymentMethodUpdated = false;
    let newPaymentMethod = null;

    // 处理可更新字段（注意：多日分行结构下，某些字段的更新逻辑需要特殊处理）
    // room_number、check_in_date、check_out_date、total_price 在多日分行结构下需要特别处理
    const updateableFields = ['guest_name', 'phone', 'room_type',
      'payment_method', 'remarks'];

    // 检查是否需要重新计算stay_type（如果日期发生变化）
    let shouldUpdateStayType = false;
    let newStayType = null;

    if (updatedData.check_in_date !== undefined || updatedData.check_out_date !== undefined) {
      // 日期变更在多日分行结构下需要特殊处理（可能需要增减行）
      // 这里先记录，但完整的日期变更逻辑较复杂，需要单独函数处理
      console.warn('⚠️ [updateOrder] 日期变更在多日分行结构下需要使用专门的函数处理');

      // 使用新的日期或保持原有日期
      const newCheckInDate = updatedData.check_in_date || oldOrder.check_in_date;
      const newCheckOutDate = updatedData.check_out_date || dailyRows[dailyRows.length - 1].check_out_date;

      const tempOrderData = {
        check_in_date: newCheckInDate,
        check_out_date: newCheckOutDate
      };

      newStayType = isRestRoom(tempOrderData) ? '休息房' : '客房';
      shouldUpdateStayType = (newStayType !== oldOrder.stay_type);

      if (shouldUpdateStayType) {
        console.log(`🏠 [updateOrder] 重新计算住宿类型: ${oldOrder.stay_type} -> ${newStayType} (基于日期: ${newCheckInDate} -> ${newCheckOutDate})`);
      }
    }

    updateableFields.forEach(field => {
      if (updatedData[field] !== undefined) {
        const nextValue = updatedData[field];
        updates.push(`${field} = $${paramIndex}`);
        values.push(nextValue);
        changes[field] = {
          old: oldOrder[field],
          new: nextValue
        };
        if (field === 'payment_method') {
          const oldPaymentMethod = oldOrder[field];
          if (nextValue !== oldPaymentMethod) {
            paymentMethodUpdated = true;
            newPaymentMethod = nextValue;
          }
        }
        paramIndex++;
      }
    });

    // 如果需要更新stay_type，添加到更新列表
    if (shouldUpdateStayType) {
      updates.push(`stay_type = $${paramIndex}`);
      values.push(newStayType);
      changes.stay_type = {
        old: oldOrder.stay_type,
        new: newStayType
      };
      paramIndex++;
    }

    // 如果没有要更新的字段，则提前返回
    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return { message: "没有字段需要更新" };
    }

    // 更新订单表 - 更新所有关联的每日记录
    const updateQuery = `
      UPDATE ${tableName}
      SET ${updates.join(', ')}
      WHERE order_id = $${paramIndex}
      RETURNING *
    `;

    values.push(orderNumber);
    const { rows: updatedRows } = await client.query(updateQuery, values);

    if (paymentMethodUpdated) {
      const { rowCount: syncedCount } = await client.query(
        `UPDATE bills
            SET pay_way = $1
          WHERE order_id = $2
            AND change_type = '房费'`,
        [newPaymentMethod, orderNumber]
      );
      if (syncedCount > 0) {
        console.log(`🧾 [updateOrder] 同步更新 ${syncedCount} 条房费账单支付方式 -> ${newPaymentMethod}`);
      } else {
        console.log('ℹ️ [updateOrder] 未找到需要同步支付方式的房费账单');
      }
    }

    await client.query('COMMIT');

    // 记录变更到 order_changes 表
    try {
      const insertChangeQuery = `
        INSERT INTO order_changes
        (order_id, changed_by, changes, reason)
        VALUES ($1, $2, $3, $4)
      `;

      await query(insertChangeQuery, [
        orderNumber,
        changedBy,
        JSON.stringify(changes),
        updatedData.reason || '订单信息更新'
      ]);
      console.log(`📝 [updateOrder] 变更记录已保存到 order_changes 表`);
    } catch (changeLogError) {
      // 变更记录失败不应该影响订单更新的成功
      console.warn(`⚠️ [updateOrder] 保存变更记录失败，但订单更新成功:`, changeLogError.message);
    }

    // 返回聚合视图
    return await getOrderById(orderNumber);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('更新订单失败:', error);
    throw error;
  } finally {
    // 确保释放客户端连接
    client.release();
  }
}

/**
 * 更新订单特定日期的房间号（支持多日分行的房间变更）
 * @param {string} orderNumber - 订单号 (order_id)
 * @param {string} stayDate - 住宿日期 (YYYY-MM-DD)
 * @param {string} newRoomNumber - 新房间号
 * @param {string} changedBy - 操作人
 * @returns {Promise<Object>} 更新后的单日记录
 */
async function updateOrderDayRoom(orderNumber, stayDate, newRoomNumber, changedBy = 'system') {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 获取指定日期的订单记录
    const { rows: [oldRow] } = await client.query(
      `SELECT * FROM ${tableName} WHERE order_id = $1 AND stay_date = $2`,
      [orderNumber, stayDate]
    );

    if (!oldRow) {
      throw new Error(`订单 ${orderNumber} 在 ${stayDate} 没有记录`);
    }

    const oldRoomNumber = oldRow.room_number;

    // 检查新房间在该日期是否可用
    const conflictResult = await client.query(`
      SELECT order_id, guest_name, room_number, stay_date
      FROM ${tableName}
      WHERE room_number = $1
        AND stay_date = $2
        AND order_id != $3
        AND status NOT IN ('cancelled', 'checked-out')
    `, [newRoomNumber, stayDate, orderNumber]);

    if (conflictResult.rows.length > 0) {
      const conflict = conflictResult.rows[0];
      throw new Error(`房间 ${newRoomNumber} 在 ${stayDate} 已被订单 ${conflict.order_id} (${conflict.guest_name}) 占用`);
    }

    // 验证新房间存在且类型匹配
    const { rows: [room] } = await client.query(
      `SELECT room_number, type_code FROM rooms WHERE room_number = $1`,
      [newRoomNumber]
    );

    if (!room) {
      throw new Error(`房间 ${newRoomNumber} 不存在`);
    }

    // 更新房间号及房型，允许跨房型更换
    const { rows: [updatedRow] } = await client.query(`
      UPDATE ${tableName}
      SET room_number = $1,
          room_type = $2
      WHERE order_id = $3 AND stay_date = $4
      RETURNING *
    `, [newRoomNumber, room.type_code, orderNumber, stayDate]);

    await client.query('COMMIT');

    // 记录变更
    try {
      const insertChangeQuery = `
        INSERT INTO order_changes
        (order_id, changed_by, changes, reason)
        VALUES ($1, $2, $3, $4)
      `;

      await query(insertChangeQuery, [
        orderNumber,
        changedBy,
        JSON.stringify({
          room_number: { old: oldRoomNumber, new: newRoomNumber },
          stay_date: stayDate
        }),
        `更换 ${stayDate} 的房间`
      ]);
      console.log(`📝 [updateOrderDayRoom] 变更记录已保存`);
    } catch (changeLogError) {
      console.warn(`⚠️ [updateOrderDayRoom] 保存变更记录失败:`, changeLogError.message);
    }

    console.log(`✅ [updateOrderDayRoom] 订单 ${orderNumber} 的 ${stayDate} 房间已从 ${oldRoomNumber} 更换为 ${newRoomNumber}`);
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
 * 退押金
 * @param {Object} refundData - 退押金数据
 * @returns {Promise<Object>} 更新后的订单对象
 */
async function refundDeposit(refundData) {
  try {
    console.log('处理退押金请求:', refundData);

    // 获取订单信息
    const order = await getOrderById(refundData.order_id);
    console.log('关联订单信息:', order);

    // 确保退押金额不超过押金
    if (refundData.change_price > order[0].deposit) {
      throw new Error('退押金额不能超过订单押金');
    }

    if (!order) {
      console.log('！！！！获取订单失败');
      throw new Error(`订单号 '${refundData.order_id}' 不存在`);
    }

    const allowed = ['checked-out', 'cancelled'];
    // order 是数组
    if (!order.every(o => allowed.includes(o.status))) {
      throw new Error('只有已退房或已取消的订单才能退押金');
    }

    refundData.change_type = '退押';
    refundData.change_price = -Math.abs(refundData.change_price || 0); // 确保为负数

    const dpData = {
      ...refundData,
      change_type: '退押',
      change_price: refundData.change_price,
      room_number: order[0].room_number,
      guest_name: order[0].guest_name,
      remarks: refundData.remarks || `订单退押`,
      stay_type: order[0].stay_type,
      stay_date: order[0].check_out_date
    }
    console.log('准备创建退押金账单，数据如下:', dpData);


    const billRes = await billModule.addBill(dpData);

    if (!billRes) {
      throw new Error('创建账单失败', billRes);
    }

    return billRes;

  } catch (error) {
    console.error('退押金处理失败:', error);
    throw error;
  }
}

/**
 * 获取订单押金状态（基于账单）
 * @param {string} orderId
 * @returns {Promise<{orderId:string, deposit:number, refunded:number, remaining:number}>}
 */
async function getDepositStatus(orderId) {
  try {
    // 优先使用 orders.deposit
    const ord = await query(`SELECT deposit FROM orders WHERE order_id=$1`, [orderId]);
    let deposit = 0;
    if (ord.rows.length) deposit = parseFloat(ord.rows[0].deposit) || 0;

    // 如果 orders.deposit 为 0，尝试从 bills.deposit 读取（兼容旧结构）
    if (deposit === 0) {
      const colDep = await query(`SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='deposit' LIMIT 1`);
      if (colDep.rows.length) {
        const b = await query(`SELECT deposit FROM bills WHERE order_id=$1 AND COALESCE(deposit,0)>0 ORDER BY create_time ASC LIMIT 1`, [orderId]);
        if (b.rows.length) deposit = parseFloat(b.rows[0].deposit) || 0;
      }
    }

    // 计算已退押金（兼容 refund_deposit 和 change_type='退押'）
    let legacyRefunded = 0;
    const colRef = await query(`SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='refund_deposit' LIMIT 1`);
    if (colRef.rows.length) {
      const r = await query(`SELECT ABS(COALESCE(MIN(refund_deposit),0)) AS legacy_refunded FROM bills WHERE order_id=$1`, [orderId]);
      legacyRefunded = parseFloat(r.rows[0].legacy_refunded) || 0;
    }
    const r2 = await query(`SELECT COALESCE(SUM(CASE WHEN change_type='退押' THEN ABS(COALESCE(change_price,0)) ELSE 0 END),0) AS change_refunded FROM bills WHERE order_id=$1`, [orderId]);
    const changeRefunded = parseFloat(r2.rows[0].change_refunded) || 0;

    const refunded = legacyRefunded + changeRefunded;
    return { orderId, deposit, refunded, remaining: Math.max(0, deposit - refunded) };
  } catch (error) {
    console.error('获取押金状态失败:', error);
    throw new Error('获取押金状态失败');
  }
}

/**
 * 提前退房（支持多日分行结构）
 * @param {string} orderNumber - 订单号
 * @param {Object} options - 提前退房参数
 * @param {string|Date} [options.actualCheckoutTime] - 实际退房时间
 * @param {number|string} [options.refundAmount] - 操作员确定的退款金额
 * @param {string} [options.refundMethod] - 退款方式
 * @param {string} [options.changedBy='system'] - 操作人
 * @param {string} [options.remarks] - 备注
 * @param {boolean} [options.hasStayed=true] - 是否已入住
 * @returns {Promise<Object>} 提前退房结果
 */
async function earlyCheckout(orderNumber, options = {}) {
  const {
    actualCheckoutTime,
    refundAmount,
    refundMethod,
    changedBy = 'system',
    remarks,
    hasStayed = true
  } = options;

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 获取该订单的所有每日记录（多日分行结构）
    const { rows: orderRows } = await client.query(
      `SELECT * FROM ${tableName} WHERE order_id = $1 ORDER BY stay_date FOR UPDATE`,
      [orderNumber]
    );

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
    const actualCheckoutDateStr = formatDate(actualCheckoutTime || new Date());

    const originalCheckoutDate = new Date(originalCheckoutDateStr);
    const actualCheckoutDate = new Date(actualCheckoutDateStr);

    // 计算原始总价（聚合所有行）
    const originalTotalPrice = orderRows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);

    if (!hasStayedFlag) {
      // 未入住退房逻辑
      let parsedRefund = refundAmount !== undefined && refundAmount !== null && refundAmount !== ''
        ? Number(refundAmount)
        : null;

      if (parsedRefund === null || Number.isNaN(parsedRefund)) {
        const { rows: [billSumRow] } = await client.query(
          `SELECT COALESCE(SUM(change_price), 0) AS net_paid FROM bills WHERE order_id = $1`,
          [orderNumber]
        );
        const netPaid = Number(billSumRow?.net_paid || 0);
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

      // 更新所有行的状态为 cancelled
      await client.query(
        `UPDATE ${tableName}
            SET check_out_date = $1,
                status = 'cancelled',
                total_price = 0
          WHERE order_id = $2`,
        [actualCheckoutDateStr, orderNumber]
      );

      let refundBillRow = null;
      if (finalRefund > 0) {
        const refundRemark = remarks || '未入住退房退款';
        const refundResult = await client.query(
          `INSERT INTO bills (
              order_id, room_number, guest_name, change_price, change_type,
              pay_way, create_time, remarks, stay_type, stay_date
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING *`,
          [
            orderNumber,
            String(firstRow.room_number || '').slice(0, 10),
            firstRow.guest_name,
            Number((-finalRefund).toFixed(2)),
            '退款',
            refundPayWay,
            formatDateTimeForDB(),
            refundRemark,
            firstRow.stay_type,
            actualCheckoutDateStr
          ]
        );
        refundBillRow = refundResult.rows[0];
      }

      await client.query(
        `UPDATE rooms SET status = $1 WHERE room_number = $2`,
        ['available', firstRow.room_number]
      );

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
        await query(
          `INSERT INTO order_changes
             (order_id, changed_by, changes, reason)
           VALUES ($1, $2, $3, $4)`,
          [
            orderNumber,
            changedBy,
            JSON.stringify(changeDetails),
            remarks || '未入住退房办理'
          ]
        );
        console.log(`📝 [earlyCheckout] 未入住退房变更记录已保存`);
      } catch (logError) {
        console.warn(`⚠️ [earlyCheckout] 保存变更记录失败:`, logError.message);
      }

      const updatedOrder = await getOrderById(orderNumber);
      return {
        success: true,
        order: updatedOrder,
        refund: {
          actual: finalRefund,
          method: refundPayWay,
          bill: refundBillRow
        },
        refundedStayDates: [],
        cancelled: true
      };
    }

    // 已入住提前退房逻辑
    if (!(actualCheckoutDate < originalCheckoutDate)) {
      const err = new Error('实际退房日期未早于原退房日期，无法执行提前退房');
      err.code = 'EARLY_CHECKOUT_NOT_EARLY';
      err.statusCode = 400;
      throw err;
    }

    // 获取需要退款的房费账单（实际退房日期之后的）
    const { rows: roomFeeBills } = await client.query(
      `SELECT bill_id, stay_date, change_price
         FROM bills
        WHERE order_id = $1
          AND change_type = $2
          AND stay_date >= $3
        ORDER BY stay_date`,
      [orderNumber, '房费', actualCheckoutDateStr]
    );

    const recommendedRefundRaw = roomFeeBills.reduce(
      (sum, bill) => sum + Number(bill.change_price || 0),
      0
    );
    const recommendedRefund = Number(recommendedRefundRaw.toFixed(2));

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

    // 更新所有行的状态为 checked-out，并更新退房日期
    await client.query(
      `UPDATE ${tableName}
          SET check_out_date = $1,
              status = 'checked-out'
        WHERE order_id = $2`,
      [actualCheckoutDateStr, orderNumber]
    );

    // 删除未入住日期的订单行（stay_date >= 实际退房日期）
    await client.query(
      `DELETE FROM ${tableName}
        WHERE order_id = $1
          AND stay_date >= $2`,
      [orderNumber, actualCheckoutDateStr]
    );

    let refundBillRow = null;
    if (finalRefund > 0) {
      const refundRemark = remarks || `提前退房退款（原退房日: ${originalCheckoutDateStr}）`;
      const refundResult = await client.query(
        `INSERT INTO bills (
            order_id, room_number, guest_name, change_price, change_type,
            pay_way, create_time, remarks, stay_type, stay_date
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          orderNumber,
          String(firstRow.room_number || '').slice(0, 10),
          firstRow.guest_name,
          Number((-finalRefund).toFixed(2)),
          '房费',
          refundPayWay,
          formatDateTimeForDB(),
          refundRemark,
          firstRow.stay_type,
          actualCheckoutDateStr
        ]
      );
      refundBillRow = refundResult.rows[0];
    }

    await client.query(
      `UPDATE rooms SET status = $1 WHERE room_number = $2`,
      ['cleaning', firstRow.room_number]
    );

    await client.query('COMMIT');

    const refundedStayDates = roomFeeBills.map(bill => formatDate(bill.stay_date));
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
      await query(
        `INSERT INTO order_changes
           (order_id, changed_by, changes, reason)
         VALUES ($1, $2, $3, $4)`,
        [
          orderNumber,
          changedBy,
          JSON.stringify(changeDetails),
          remarks || '提前退房办理'
        ]
      );
      console.log(`📝 [earlyCheckout] 变更记录已保存`);
    } catch (logError) {
      console.warn(`⚠️ [earlyCheckout] 保存变更记录失败:`, logError.message);
    }

    const updatedOrder = await getOrderById(orderNumber);
    return {
      success: true,
      order: updatedOrder,
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
 * 办理入住：创建房费/押金账单并更新订单状态
 * @param {string} orderId 订单号
 * @param {number|string} depositAmount 实收押金
 * @returns {Promise<Array>} 创建的账单记录
 */
async function checkIn(orderId, depositAmount, client) {
  const manageTx = !client; // 是否需要自行管理事务
  const runner = client || await getClient();
  let txStarted = false; // 事务是否已开始

  const createdBills = [];
  const parsedDeposit = toAmountNumber(depositAmount || 0);
  const hasDeposit = parsedDeposit > 0;

  try {
    // 查询订单信息
    const { rows: orderRows } = await runner.query(
      'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date',
      [orderId]
    );
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
    if (manageTx) { // 需要自行管理事务
      await runner.query('BEGIN');
      txStarted = true;
      console.log('✅ [check-in] 事务开始');
    }

    // 给订单设置押金
    if (hasDeposit) {
      const updateDepositQuery = `
        UPDATE orders
        SET deposit = $1
        WHERE id = $2
      `;
      await runner.query(updateDepositQuery, [parsedDeposit, firstOrder.id]);
      console.log(`📝 [check-in] 更新订单 ${orderId} 押金: ${firstOrder.deposit} -> ${parsedDeposit}`);

      const dpData = {
        order_id: orderId,
        room_number: firstOrder.room_number,
        guest_name: firstOrder.guest_name,
        change_price: parsedDeposit,
        change_type: '收押',
        pay_way: firstOrder.payment_method,
        create_time: formatDateTimeForDB(),
        remarks: '办理入住押金',
        stay_type: firstOrder.stay_type,
        stay_date: firstOrder.check_in_date
      };
      // 插入押金账单
      const depositBill = await billModule.addBill(dpData, runner);
      createdBills.push(depositBill);
      console.log(`📝 [check-in] 插入押金账单，金额: ${parsedDeposit}`);
    }

    // 更新订单状态为已入住
    await updateOrderStatus(orderId, 'checked-in', runner);
    console.log(`📝 [check-in] 更新订单 ${orderId} 状态为已入住`);

    // 修改房间状态为已入住
    await runner.query(
      `UPDATE rooms SET status = $1 WHERE room_number = $2`,
      ['occupied', firstOrder.room_number]
    );
    console.log(`📝 [check-in] 更新房间 ${firstOrder.room_number} 状态为已入住`);

    // 为每个住宿日插入房费账单
    for (const ord of orderRows) {
      const billData = {
        order_id: orderId,
        room_number: ord.room_number,
        guest_name: ord.guest_name,
        change_price: toAmountNumber(ord.total_price),
        change_type: '房费',
        pay_way: ord.payment_method,
        create_time: formatDateTimeForDB(),
        remarks: '办理入住房费',
        stay_type: ord.stay_type,
        stay_date: ord.stay_date
      };
      console.log('!!!!!账单日期是:', billData.stay_date);
      const roomBill = await billModule.addBill(billData, runner);
      createdBills.push(roomBill);
      console.log(`📝 [check-in] 插入房费账单，金额: ${ord.total_price}，入住日期: ${ord.stay_date}`);
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
 * 快速入住：在一个事务中创建已入住订单和相应账单（支持多日分行结构）
 * @param {Object} orderData - 前端传递的订单数据
 * @param {string} createdBy - 操作员用户名
 * @returns {Promise<Object>} - 包含创建的订单和账单
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
      stayType: orderData.stayType || orderData.stay_type,
      status: 'pending'
    };
    const depositAmount = toAmountNumber(orderData.deposit || 0);

    let client = await getClient();
    try {
      await client.query('BEGIN');

      await createOrder(normalized, client);
      console.log('✅ [fastCheckIn] 订单创建成功');

      await checkIn(normalized.orderId, depositAmount, client);

      await client.query('COMMIT');

      const aggregatedOrder = await getOrderById(normalized.orderId);
      const { rows: createdBills } = await query(
        `SELECT * FROM bills WHERE order_id = $1 ORDER BY stay_date, bill_id`,
        [normalized.orderId]
      );

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

/**
 * 办理退房：更新订单状态并将房间设为清洁中
 * @param {string} orderId
 */
async function checkOut(orderId, client) {
  try {
    const manageTx = !client; // 是否需要自行管理事务
    console.log(`🚪 [checkOut] 办理退房，订单号: ${orderId}, 管理事务: ${manageTx}`);
    const runner = client || await getClient();
    let txStarted = false;

    try {
      // 开启事务
      if (manageTx) {
        await runner.query('BEGIN');
        txStarted = true;
      }

      // update order status
      await updateOrderStatus(orderId, 'checked-out', runner);
      console.log(`✅ [checkOut] 订单 ${orderId} 状态更新为已退房`);

      const { rows: orderRows } = await runner.query(
        `SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date`,
        [orderId]
      );

      // update room status to 'cleaning'
      for (const ord of orderRows) {
        await runner.query(
          `UPDATE rooms SET status = $1 WHERE room_number = $2`,
          ['cleaning', ord.room_number]
        );
      }

      // commit transaction
      if (manageTx) {
        await runner.query('COMMIT');
      }

      return await getOrderById(orderId);
    } catch (error) {
      if (manageTx && txStarted) {
        await runner.query('ROLLBACK');
        console.log('❌ [checkOut] 事务回滚成功');
      }
      throw error;
    } finally {
      if (manageTx) {
        runner.release();
      }
    }
  } catch (error) {
    console.error('❌ [checkOut] 办理退房失败:', error);
    throw error;
  }
}

/**
 * 更新订单和相关账单（联合事务）
 * @param {string} orderNumber - 订单号
 * @param {Object} updatedData - 更新数据
 * @param {Object} billUpdates - 账单更新数据 { "2025-09-12": { room_fee: 300 }, "2025-09-13": { room_fee: 350 } }
 * @param {string} changedBy - 修改人
 * @returns {Promise<Object>} 更新结果
 */
async function updateOrderWithBills(orderNumber, updatedData, billUpdates = {}, changedBy = 'system') {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 获取原始订单数据
    const { rows: [oldOrder] } = await client.query(
      `SELECT * FROM ${tableName} WHERE order_id = $1`,
      [orderNumber]
    );

    if (!oldOrder) {
      throw new Error(`订单 ${orderNumber} 不存在`);
    }

    const { rows: billColumnRows } = await client.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'bills'`
    );
    const existingBillColumns = new Set(billColumnRows.map(row => row.column_name));
    const hasChangePriceColumn = existingBillColumns.has('change_price');
    const billFieldMap = {
      room_fee: existingBillColumns.has('room_fee') ? 'room_fee' : (hasChangePriceColumn ? 'change_price' : null),
      deposit: existingBillColumns.has('deposit') ? 'deposit' : null,
      refund_deposit: existingBillColumns.has('refund_deposit') ? 'refund_deposit' : null,
      total_income: existingBillColumns.has('total_income') ? 'total_income' : null,
      pay_way: existingBillColumns.has('pay_way') ? 'pay_way' : null,
      remarks: existingBillColumns.has('remarks') ? 'remarks' : null,
      change_price: hasChangePriceColumn ? 'change_price' : null
    };

    // 1. 更新账单表
    const billUpdateResults = [];
    for (const [stayDate, billData] of Object.entries(billUpdates)) {
      if (billData && Object.keys(billData).length > 0) {
        console.log(`📝 [updateOrderWithBills] 更新日期 ${stayDate} 的账单:`, billData);

        const updateFields = [];
        const values = [];
        const skippedFields = [];
        let paramIndex = 1;

        Object.entries(billData).forEach(([field, rawValue]) => {
          const normalizedField = typeof field === 'string' ? field.trim() : field;
          let targetColumn = billFieldMap[normalizedField];

          if (!targetColumn && existingBillColumns.has(normalizedField)) {
            targetColumn = normalizedField;
          }

          if (!targetColumn) {
            skippedFields.push(normalizedField);
            console.warn(`⚠️ [updateOrderWithBills] 字段 ${normalizedField} 在 bills 表中不存在，已跳过`);
            return;
          }

          let value = rawValue;
          if (['room_fee', 'change_price', 'deposit', 'refund_deposit', 'total_income'].includes(targetColumn)) {
            const parsed = Number(rawValue);
            value = Number.isFinite(parsed) ? parsed : 0;
          }

          if (normalizedField === 'room_fee' && targetColumn === 'change_price') {
            console.log('ℹ️ [updateOrderWithBills] 将 room_fee 映射为 change_price 字段');
          }

          updateFields.push(`${targetColumn} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        });

        if (updateFields.length > 0) {
          const billUpdateQuery = `
            UPDATE bills
            SET ${updateFields.join(', ')}
            WHERE order_id = $${paramIndex} AND DATE(stay_date) = DATE($${paramIndex + 1})
            RETURNING *
          `;
          values.push(orderNumber, stayDate);

          const billResult = await client.query(billUpdateQuery, values);
          billUpdateResults.push({
            date: stayDate,
            updated: billResult.rows.length > 0,
            data: billResult.rows[0] || null,
            skippedFields
          });

          if (billResult.rows.length === 0) {
            console.warn(`⚠️ [updateOrderWithBills] 未找到订单 ${orderNumber} 日期 ${stayDate} 的账单记录`);
          } else {
            console.log(`✅ [updateOrderWithBills] 成功更新日期 ${stayDate} 的账单`);
          }
        } else {
          billUpdateResults.push({
            date: stayDate,
            updated: false,
            data: null,
            skippedFields
          });
          console.warn(`⚠️ [updateOrderWithBills] 日期 ${stayDate} 没有可更新字段，已跳过`);
        }
      }
    }

    // 2. 更新订单表
    let updatedOrder = oldOrder;
    let paymentMethodUpdated = false;
    let newPaymentMethod = null;

    if (updatedData && Object.keys(updatedData).length > 0) {
      const updates = [];
      const orderValues = [];
      const changes = {}; // 记录变更
      let paramIndex = 1;

      // 处理可更新字段
      const updateableFields = ['guest_name', 'phone', 'room_type',
        'room_number', 'check_in_date', 'check_out_date',
        'payment_method', 'total_price', 'deposit', 'remarks'];

      updateableFields.forEach(field => {
        if (updatedData[field] !== undefined) {
          const nextValue = updatedData[field];
          updates.push(`${field} = $${paramIndex}`);
          orderValues.push(nextValue);
          changes[field] = {
            old: oldOrder[field],
            new: nextValue
          };
          if (field === 'payment_method' && nextValue !== oldOrder[field]) {
            paymentMethodUpdated = true;
            newPaymentMethod = nextValue;
          }
          paramIndex++;
        }
      });

      if (updates.length > 0) {
        // 更新订单表
        const updateQuery = `
          UPDATE ${tableName}
          SET ${updates.join(', ')}
          WHERE order_id = $${paramIndex}
          RETURNING *
        `;
        orderValues.push(orderNumber);

        const { rows: [orderResult] } = await client.query(updateQuery, orderValues);
        updatedOrder = orderResult;

        console.log(`📝 [updateOrderWithBills] 订单更新成功:`, changes);
      }
    }

    if (paymentMethodUpdated) {
      const { rowCount: syncedCount } = await client.query(
        `UPDATE bills
            SET pay_way = $1
          WHERE order_id = $2
            AND change_type = '房费'`,
        [newPaymentMethod, orderNumber]
      );
      if (syncedCount > 0) {
        console.log(`🧾 [updateOrderWithBills] 同步更新 ${syncedCount} 条房费账单支付方式 -> ${newPaymentMethod}`);
      } else {
        console.log('ℹ️ [updateOrderWithBills] 未找到需要同步支付方式的房费账单');
      }
    }

    await client.query('COMMIT');

    return {
      success: true,
      order: updatedOrder,
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

const table = {
  checkTableExists,
  createOrder,
  getAllOrders,
  getAllOrdersDaily,
  getOrderById,
  getOrderRowById,
  updateOrderStatus,
  updateOrder,
  updateOrderDayRoom,
  refundDeposit,
  getDepositStatus,
  isRestRoom,
  earlyCheckout,
  updateOrderWithBills,
  checkIn,
  fastCheckIn,
  checkOut
};

module.exports = table;
