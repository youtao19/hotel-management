const { query, getClient } = require('../database/postgreDB/pg');
const billModule = require('./billModule');
const setup = require('../appSettings/setup');
const { formatDate, formatDateTimeForDB} = require('./tools');

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
 * 验证订单状态是否有效
 * @param {string} status - 订单状态
 * @returns {boolean} 状态是否有效
 */
function isValidOrderStatus(status) {
  return VALID_ORDER_STATES.includes(status);
}

/**
 * 检查订单是否存在
 * @param {Object} orderData 订单数据
 * @returns {Promise<Object|null>} 存在的订单或null
 */
async function checkExistingOrder(orderData) {
  const { guest_name, check_in_date, check_out_date, room_number } = orderData;

  const checkQuery = `
    SELECT * FROM ${tableName}
    WHERE guest_name = $1
    AND check_in_date = $2
    AND check_out_date = $3
    AND room_number = $4
    AND status NOT IN ('cancelled', 'checked-out')
  `;

  const result = await query(checkQuery, [guest_name, check_in_date, check_out_date, room_number]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 处理订单创建时的数据库错误
 * @param {Error} error 数据库错误
 * @param {Object} orderData 订单数据
 * @throws {Error} 格式化后的错误信息
 */
function handleOrderCreationError(error, orderData) {
  const { room_number, room_type, order_id } = orderData;

  // 外键约束错误
  if (error.code === '23503') {
    switch (error.constraint) {
      case 'orders_room_number_fkey':
        throw new Error(`房间号 '${room_number}' 不存在或无效`);
      case 'orders_room_type_fkey':
        throw new Error(`房型 '${room_type}' 不存在或无效`);
      default:
        throw new Error(`创建订单失败：关联数据不存在 - ${error.detail}`);
    }
  }

  // 唯一约束错误
  if (error.code === '23505') {
    if (error.constraint === 'orders_pkey') {
      throw new Error(`订单号 '${order_id}' 已存在`);
    }
    if (error.constraint === 'unique_order_constraint') {
      throw new Error(`该客人在相同时间段已有相同房间(${room_number})的预订`);
    }
    throw new Error(`创建订单失败：数据重复 - ${error.detail}`);
  }

  // 其他数据库错误
  throw new Error(`创建订单失败：${error.message}`);
}

/**
 * 检查是否为休息房（入住和退房是同一天）
 * @param {Object} orderData 订单数据
 * @returns {boolean} 是否为休息房
 */
function isRestRoom(orderData) {
  const toLocalYMD = (d) => {
    if (d == null) return '';
    if (typeof d === 'string') return d.slice(0,10); // 已经是 'YYYY-MM-DD'
    const dt = (d instanceof Date) ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,'0');
    const day = String(dt.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const checkInDateStr = toLocalYMD(orderData.check_in_date);
  const checkOutDateStr = toLocalYMD(orderData.check_out_date);
  return checkInDateStr === checkOutDateStr;
}

/**
 * 计算订单房间总价格
 * @param {Object|number} roomPriceData - 房间价格数据（JSONB对象或数字）
 * @returns {number} 房间总价格
 */
function calculateTotalPrice(roomPriceData) {
  if (typeof roomPriceData === 'number') {
    return roomPriceData;
  }

  if (typeof roomPriceData === 'object' && roomPriceData !== null) {
    return Object.values(roomPriceData).reduce((sum, price) => sum + parseFloat(price), 0);
  }

  return 0;
}

/**
 * 验证价格日期范围
 * @param {Object} totalPrice - 总价格对象
 * @param {string} checkInDate - 入住日期
 * @param {string} checkOutDate - 退房日期
 * @returns {Object} 验证结果 {isValid: boolean, message?: string}
 */
function validatePriceDateRange(totalPrice, checkInDate, checkOutDate) {
  if (typeof totalPrice !== 'object' || totalPrice === null) {
    return { isValid: true };
  }

  const priceDates = Object.keys(totalPrice).sort();
  const firstPriceDate = priceDates[0];
  const lastPriceDate = priceDates[priceDates.length - 1];

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const firstPrice = new Date(firstPriceDate);
  const lastPrice = new Date(lastPriceDate);

  // 价格开始日期应该等于入住日期
  if (firstPrice.getTime() !== checkIn.getTime()) {
    return {
      isValid: false,
      message: `价格开始日期 ${firstPriceDate} 与入住日期 ${checkInDate} 不匹配`
    };
  }

  // 计算入住天数（实际居住的晚数）
  const daysDiff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`🏨 日期验证 - 入住: ${checkInDate}, 退房: ${checkOutDate}, 天数差: ${daysDiff}`);
  console.log(`📊 价格日期数量: ${priceDates.length}, 日期: [${priceDates.join(', ')}]`);

  // 对于休息房（同日入住退房），价格应该只有入住日期
  if (daysDiff === 0) {
    if (priceDates.length !== 1 || firstPriceDate !== checkInDate) {
      return {
        isValid: false,
        message: `休息房订单价格数据应只包含入住日期 ${checkInDate}`
      };
    }
  }
  // 对于住1晚的订单，价格应该只有入住日期
  else if (daysDiff === 1) {
    if (priceDates.length !== 1 || firstPriceDate !== checkInDate) {
      return {
        isValid: false,
        message: `单日住宿订单价格数据应只包含入住日期 ${checkInDate}，不应包含退房日期`
      };
    }
  }
  // 对于多日住宿（2晚及以上）
  else {
    // 价格结束日期应该是退房前一天
    const dayBeforeCheckOut = new Date(checkOut);
    dayBeforeCheckOut.setDate(dayBeforeCheckOut.getDate() - 1);
    const expectedLastDate = dayBeforeCheckOut.toISOString().split('T')[0];

    if (lastPrice.getTime() !== dayBeforeCheckOut.getTime()) {
      return {
        isValid: false,
        message: `多日住宿价格结束日期 ${lastPriceDate} 与预期日期 ${expectedLastDate} 不匹配`
      };
    }

    // 验证价格日期的连续性 - 应该等于住宿晚数
    if (priceDates.length !== daysDiff) {
      return {
        isValid: false,
        message: `${daysDiff}晚住宿应包含 ${daysDiff} 个价格数据，但实际包含 ${priceDates.length} 个`
      };
    }

    // 验证日期连续性
    for (let i = 0; i < priceDates.length; i++) {
      const expectedDate = new Date(checkIn);
      expectedDate.setDate(expectedDate.getDate() + i);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];

      if (priceDates[i] !== expectedDateStr) {
        return {
          isValid: false,
          message: `价格日期不连续，第${i + 1}个日期应为 ${expectedDateStr}，实际为 ${priceDates[i]}`
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * 验证订单数据
 * @param {Object} orderData 订单数据
 * @throws {Error} 验证失败时抛出错误
 */
function validateOrderData(orderData) {
  // 1. 验证必填字段
  const requiredFields = [
    { field: 'guest_name', name: '客人姓名' },
    { field: 'room_type', name: '房间类型' },
    { field: 'room_number', name: '房间号' },
    { field: 'check_in_date', name: '入住日期' },
    { field: 'check_out_date', name: '退房日期' },
    { field: 'status', name: '订单状态' }
  ];

  const missingFields = requiredFields.filter(({ field }) => !orderData[field]);
  if (missingFields.length > 0) {
    const error = new Error(`缺少必填字段: ${missingFields.map(f => f.name).join(', ')}`);
    error.code = 'MISSING_REQUIRED_FIELDS';
    throw error;
  }

  // 2. 验证订单状态
  if (!isValidOrderStatus(orderData.status)) {
    const error = new Error(`无效的订单状态: ${orderData.status}。有效状态: ${VALID_ORDER_STATES.join(', ')}`);
    error.code = 'INVALID_ORDER_STATUS';
    throw error;
  }

  // 3. 验证日期
  const checkInDate = new Date(orderData.check_in_date);
  const checkOutDate = new Date(orderData.check_out_date);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    const error = new Error('无效的日期格式');
    error.code = 'INVALID_DATE_FORMAT';
    throw error;
  }

  // 允许入住和退房是同一天（休息房）
  if (checkInDate > checkOutDate) {
    const error = new Error('入住日期不能晚于退房日期');
    error.code = 'INVALID_DATE_RANGE';
    throw error;
  }

  // 4. 验证电话号码格式（可选字段）
  // 如果提供了手机号，才验证格式
  if (orderData.phone && orderData.phone.trim() !== '') {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(orderData.phone)) {
      const error = new Error('无效的电话号码格式');
      error.code = 'INVALID_PHONE_FORMAT';
      throw error;
    }
  }

  // 5. 验证价格和押金
  // 使用 !== undefined 判断，确保 0 这样的值也进入验证分支
  if (orderData.total_price !== undefined) {
    if (typeof orderData.total_price === 'object') {
      // JSON格式验证：验证每个日期的价格
      const prices = Object.values(orderData.total_price);
      const dates = Object.keys(orderData.total_price);

      if (prices.length === 0) {
        const error = new Error('总价格不能为空');
        error.code = 'INVALID_PRICE_EMPTY';
        throw error;
      }

      if (prices.some(price => !price || parseFloat(price) <= 0)) {
        const error = new Error('所有日期的总价格必须大于0');
        error.code = 'INVALID_PRICE_JSON';
        throw error;
      }

      // 验证日期格式
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dates.some(date => !dateRegex.test(date))) {
        const error = new Error('价格数据中包含无效的日期格式');
        error.code = 'INVALID_PRICE_DATE_FORMAT';
        throw error;
      }

      // 验证价格日期范围
      const priceRangeValidation = validatePriceDateRange(
        orderData.total_price,
        orderData.check_in_date,
        orderData.check_out_date
      );
      if (!priceRangeValidation.isValid) {
        const error = new Error(priceRangeValidation.message);
        error.code = 'INVALID_PRICE_DATE_RANGE';
        throw error;
      }
    } else {
      // 向后兼容：数字格式验证（包括 0 / 负数）
      const numericPrice = parseFloat(orderData.total_price);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        const error = new Error('总价格必须大于0');
        error.code = 'INVALID_PRICE';
        throw error;
      }
    }
  }

  if (orderData.deposit && parseFloat(orderData.deposit) < 0) {
    const error = new Error('押金不能为负数');
    error.code = 'INVALID_DEPOSIT';
    throw error;
  }

  // 6. 验证住宿类型（如果前端传入了该字段）
  if (orderData.stay_type !== undefined) {
    const validStayTypes = ['休息房', '客房'];
    if (!validStayTypes.includes(orderData.stay_type)) {
      const error = new Error(`无效的住宿类型: ${orderData.stay_type}。有效类型: ${validStayTypes.join(', ')}`);
      error.code = 'INVALID_STAY_TYPE';
      throw error;
    }

    // 检查前端传入的stay_type是否与日期计算结果一致
    const calculatedStayType = isRestRoom(orderData) ? '休息房' : '客房';
    if (orderData.stay_type !== calculatedStayType) {
      console.warn(`⚠️ [validateOrderData] 前端传入的住宿类型 "${orderData.stay_type}" 与根据日期计算的结果 "${calculatedStayType}" 不一致`);
      // 注意：这里只是警告，不抛出错误，因为我们会以计算结果为准
    }
  }
}

/**
 * 创建新订单
 * @param {Object} orderData 订单数据
 * @returns {Promise<Object>} 创建的订单
 */
async function createOrder(orderData) {
  try {
    // 2. 检查是否存在重复订单
    const existingOrder = await checkExistingOrder(orderData);
    if (existingOrder) {
      const error = new Error('订单重复');
      error.code = 'DUPLICATE_ORDER';
      error.existingOrder = existingOrder;
      throw error;
    }

    // 3. 验证房型是否存在（兼容传入房型编码或房型名称）
    const requestedRoomType = orderData.room_type;
    const roomTypeQuery = 'SELECT * FROM room_types WHERE type_code = $1';
    let roomTypeResult = await query(roomTypeQuery, [requestedRoomType]);

    if (roomTypeResult.rows.length === 0) {
      const roomTypeByNameResult = await query(
        'SELECT * FROM room_types WHERE type_name = $1',
        [requestedRoomType]
      );

      if (roomTypeByNameResult.rows.length === 0) {
        const error = new Error(`房型 '${requestedRoomType}' 不存在`);
        error.code = 'INVALID_ROOM_TYPE';
        throw error;
      }

      // 使用房型名称匹配到的编码继续后续流程
      roomTypeResult = roomTypeByNameResult;
      orderData = {
        ...orderData,
        room_type: roomTypeResult.rows[0].type_code
      };
    }

    if (!orderData.room_type) {
      const error = new Error(`房型 '${requestedRoomType}' 无法解析`);
      error.code = 'INVALID_ROOM_TYPE';
      throw error;
    }

    // 4. 验证房间是否存在且可用
    const roomQuery = 'SELECT * FROM rooms WHERE room_number = $1';
    const roomResult = await query(roomQuery, [orderData.room_number]);
    if (roomResult.rows.length === 0) {
      const error = new Error(`房间号 '${orderData.room_number}' 不存在`);
      error.code = 'INVALID_ROOM_NUMBER';
      throw error;
    }

    if (roomResult.rows[0].type_code && roomResult.rows[0].type_code !== orderData.room_type) {
      const error = new Error(`房间 '${orderData.room_number}' 与房型 '${requestedRoomType}' 不匹配`);
      error.code = 'INVALID_ROOM_TYPE';
      throw error;
    }

    if (roomResult.rows[0].is_closed) {
      const error = new Error(`房间 '${orderData.room_number}' 已关闭，无法预订`);
      error.code = 'ROOM_CLOSED';
      throw error;
    }

    // 5. 检查房间在指定日期是否已被预订
    // 对于休息房，需要特殊的冲突检查逻辑
    const isCurrentOrderRestRoom = isRestRoom(orderData);

    let conflictQuery;
    let conflictParams;

    if (isCurrentOrderRestRoom) {
      // 休息房冲突检查：同一天同一房间不能有其他订单（排除已取消和已退房的订单）
      conflictQuery = `
        SELECT * FROM orders
        WHERE room_number = $1
        AND status NOT IN ('cancelled', 'checked-out')
        AND (
          (check_in_date = $2) OR
          (check_out_date = $2) OR
          (check_in_date < $2 AND check_out_date > $2)
        )
      `;
      conflictParams = [orderData.room_number, orderData.check_in_date];
    } else {
      // 普通订单冲突检查：日期区间重叠（排除已取消和已退房的订单）
      conflictQuery = `
        SELECT * FROM orders
        WHERE room_number = $1
        AND status NOT IN ('cancelled', 'checked-out')
        AND check_in_date < $2
        AND check_out_date > $3
      `;
      conflictParams = [
        orderData.room_number,
        orderData.check_out_date,
        orderData.check_in_date
      ];
    }

    const conflictResult = await query(conflictQuery, conflictParams);

    if (conflictResult.rows.length > 0) {
      const conflictOrder = conflictResult.rows[0];
      const isConflictRestRoom = isRestRoom(conflictOrder);

      let errorMessage;
      if (isCurrentOrderRestRoom && isConflictRestRoom) {
        errorMessage = `房间 '${orderData.room_number}' 在 ${orderData.check_in_date} 已有休息房预订`;
      } else if (isCurrentOrderRestRoom) {
        errorMessage = `房间 '${orderData.room_number}' 在 ${orderData.check_in_date} 已被其他订单占用`;
      } else if (isConflictRestRoom) {
        errorMessage = `房间 '${orderData.room_number}' 在指定日期范围内有休息房占用`;
      } else {
        errorMessage = `房间 '${orderData.room_number}' 在指定日期已被预订`;
      }

      const error = new Error(errorMessage);
      error.code = 'ROOM_ALREADY_BOOKED';
      throw error;
    }

    // 6. 插入订单数据 - 解构订单数据
    const {
      order_id, id_source, order_source, guest_name, phone,
      room_type, room_number, check_in_date, check_out_date, status,
      payment_method, total_price, deposit, create_time, remarks,
      is_prepaid, prepaid_amount, prepaid_at
    } = orderData;

    // 6.1. 根据入住退房日期自动设置住宿类型
    const stay_type = isCurrentOrderRestRoom ? '休息房' : '客房';
    console.log(`🏠 [createOrder] 自动设置住宿类型: ${stay_type} (基于日期: ${check_in_date} -> ${check_out_date})`);

    // 如果前端传入了stay_type，检查是否与计算结果一致
    if (orderData.stay_type && orderData.stay_type !== stay_type) {
      console.warn(`⚠️ [createOrder] 前端传入的住宿类型 "${orderData.stay_type}" 与计算结果 "${stay_type}" 不一致，以计算结果为准`);
    }

    // 7. 处理房间价格数据
    let processedTotalPrice = total_price;

    // 数字或数字字符串 -> 转换为以入住日为key的对象
    if (typeof total_price === 'number' || (typeof total_price === 'string' && total_price.trim() !== '' && !isNaN(parseFloat(total_price)))) {
      processedTotalPrice = {
        [check_in_date]: parseFloat(total_price)
      };
    } else if (typeof total_price === 'string' && total_price.trim().startsWith('{')) {
      // JSON字符串 -> 解析为对象
      try {
        processedTotalPrice = JSON.parse(total_price);
      } catch (e) {
        const err = new Error('价格数据格式无效，无法解析');
        err.code = 'INVALID_PRICE_JSON';
        throw err;
      }
    }

    // 确保是有效的JSON对象
    if (typeof processedTotalPrice === 'object' && processedTotalPrice !== null) {
      // 验证价格数据的日期范围是否合理
      const priceStartDate = Math.min(...Object.keys(processedTotalPrice).map(d => new Date(d).getTime()));
      const priceEndDate = Math.max(...Object.keys(processedTotalPrice).map(d => new Date(d).getTime()));
      const checkInTime = new Date(check_in_date).getTime();
      const checkOutTime = new Date(check_out_date).getTime();

      // 检查价格日期是否在订单日期范围内
      if (priceStartDate < checkInTime || priceStartDate >= checkOutTime) {
        console.warn('价格数据的日期范围可能不合理，但继续处理:', {
          priceStartDate: new Date(priceStartDate).toISOString().split('T')[0],
          priceEndDate: new Date(priceEndDate).toISOString().split('T')[0],
          checkInDate: check_in_date,
          checkOutDate: check_out_date
        });
      }
    }

    // 8. 处理休息房备注
    let processedRemarks = remarks || '';
    if (isCurrentOrderRestRoom) {
      // 确保休息房订单在备注中有标识
      if (!processedRemarks.includes('【休息房】')) {
        processedRemarks = '【休息房】' + (processedRemarks ? ' ' + processedRemarks : '');
      }
    }

    const formattedCheckInDate = formatDate(check_in_date);
    const formattedCheckOutDate = formatDate(check_out_date);

    // 提取每日房费明细（按日期排序），支持多日订单按日记账
    const dailyPriceEntries = [];
    if (processedTotalPrice && typeof processedTotalPrice === 'object' && !Array.isArray(processedTotalPrice)) {
      Object.entries(processedTotalPrice).forEach(([dateKey, amountValue]) => {
        if (!dateKey) return;
        try {
          const stayDate = formatDate(dateKey);
          const amountNum = Number(amountValue);
          if (!Number.isFinite(amountNum) || amountNum <= 0) return;
          dailyPriceEntries.push({
            stayDate,
            amount: Number(amountNum.toFixed(2))
          });
        } catch (e) {
          console.warn(`⚠️ [createOrder] 无法解析每日房价日期 '${dateKey}':`, e.message);
        }
      });
      dailyPriceEntries.sort((a, b) => new Date(a.stayDate).getTime() - new Date(b.stayDate).getTime());
    }

    console.log(`📅 [createOrder] 日期格式化: 入住 ${check_in_date} -> ${formattedCheckInDate}, 退房 ${check_out_date} -> ${formattedCheckOutDate}`);

    const normalizeBoolean = (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
      }
      return false;
    };

    const totalPriceValue = calculateTotalPrice(processedTotalPrice);

    const normalizedDeposit = (deposit === undefined || deposit === null || deposit === '')
      ? 0
      : Number(deposit);
    if (Number.isNaN(normalizedDeposit) || normalizedDeposit < 0) {
      const err = new Error('押金金额无效');
      err.code = 'INVALID_DEPOSIT';
      throw err;
    }

    const prepaidFlag = normalizeBoolean(is_prepaid);
    let prepaidAmountValue = 0;
    let prepaidAtDate = null;
    let prepaidAtForDB = null;
    let prepaidStayDate = null;

    if (prepaidFlag) {
      const resolvedAmount = (prepaid_amount === undefined || prepaid_amount === null || prepaid_amount === '')
        ? totalPriceValue
        : Number(prepaid_amount);

      if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
        const err = new Error('预收房费金额必须大于0');
        err.code = 'INVALID_PREPAID_AMOUNT';
        throw err;
      }

      if (totalPriceValue > 0 && resolvedAmount - totalPriceValue > 0.01) {
        const err = new Error('预收房费金额不能超过总房费');
        err.code = 'INVALID_PREPAID_AMOUNT';
        throw err;
      }

      prepaidAmountValue = Number(resolvedAmount.toFixed(2));

      const candidateDate = prepaid_at || create_time || new Date();
      prepaidAtDate = new Date(candidateDate);
      if (Number.isNaN(prepaidAtDate.getTime())) {
        const err = new Error(`预收时间格式无效: ${candidateDate}`);
        err.code = 'INVALID_PREPAID_AT';
        throw err;
      }

      prepaidAtForDB = formatDateTimeForDB(prepaidAtDate);
      prepaidStayDate = formatDate(prepaidAtDate);
    }

    const createTimeForDB = formatDateTimeForDB(create_time);

    // 10. 执行数据库插入操作
    const insertQuery = `
      INSERT INTO orders (
        order_id, id_source, order_source, guest_name, phone,
        room_type, room_number, check_in_date, check_out_date, status,
        payment_method, total_price, deposit, create_time, stay_type, remarks,
        is_prepaid, prepaid_amount, prepaid_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19
      )
      RETURNING *;
    `;

    const values = [
      order_id, id_source, order_source, guest_name, phone,
      room_type, room_number, formattedCheckInDate, formattedCheckOutDate, status,
      payment_method, totalPriceValue, normalizedDeposit, createTimeForDB, stay_type, processedRemarks,
      prepaidFlag, prepaidAmountValue, prepaidAtForDB
    ];

    console.log('🗃️ [createOrder] 即将插入 values:', values.map(v => (typeof v === 'string' && v.length > 120 ? v.slice(0, 120) + '…' : v)));

    const client = await getClient();
    let insertedOrder;
    try {
      await client.query('BEGIN');

      const result = await client.query(insertQuery, values);
      insertedOrder = result.rows[0];

      if (prepaidFlag && prepaidAmountValue > 0) {
        const billInsertQuery = `
          INSERT INTO bills (
            order_id, room_number, guest_name, change_price, change_type,
            pay_way, create_time, remarks, stay_type, stay_date
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
          RETURNING *;
        `;

        const fallbackStayDate = prepaidStayDate || formattedCheckInDate;
        const entriesForBilling = dailyPriceEntries.length > 0
          ? dailyPriceEntries
          : [{ stayDate: fallbackStayDate, amount: prepaidAmountValue }];

        let remaining = prepaidAmountValue;
        let lastStayDateUsed = fallbackStayDate;

        for (const entry of entriesForBilling) {
          if (remaining <= 0) break;
          const stayDate = entry.stayDate || fallbackStayDate;
          lastStayDateUsed = stayDate;
          const plannedAmount = Number(entry.amount) || 0;
          if (plannedAmount <= 0) continue;
          const amountForThisBill = Math.min(plannedAmount, remaining);

          await client.query(billInsertQuery, [
            order_id,
            String(room_number || '').slice(0, 10),
            guest_name,
            Number(amountForThisBill.toFixed(2)),
            setup.changeType.roomFee,
            payment_method,
            prepaidAtForDB || createTimeForDB,
            '创建订单预收房费',
            stay_type,
            stayDate
          ]);

          remaining = Number((remaining - amountForThisBill).toFixed(2));
        }

        if (remaining > 0.009) {
          await client.query(billInsertQuery, [
            order_id,
            String(room_number || '').slice(0, 10),
            guest_name,
            Number(remaining.toFixed(2)),
            setup.changeType.roomFee,
            payment_method,
            prepaidAtForDB || createTimeForDB,
            '创建订单预收房费(余款)',
            stay_type,
            lastStayDateUsed
          ]);
        }
      }

      await client.query('COMMIT');
      console.log('✅ [createOrder] 插入成功 order_id=', insertedOrder?.order_id);
      return insertedOrder;
    } catch (txnError) {
      await client.query('ROLLBACK');
      throw txnError;
    } finally {
      client.release();
    }

  } catch (error) {
  console.error('❌ [createOrder] 失败:', error.message);
    // 转换为具有 code 的可识别错误，供路由层分类
    if (!error.code) {
      // 简要归类常见消息
      if (/价格|日期|电话号码|押金|房型|房间号|预订|关闭/.test(error.message)) {
        error.code = 'ORDER_VALIDATION_ERROR';
      }
    }
    throw error;
  }
}

/**
 * 获取所有订单
 * @returns {Promise<Array>} 所有订单列表
 */
async function getAllOrders() {
  try {
    const result = await query('SELECT * FROM orders ORDER BY create_time DESC');
    return result.rows;
  } catch (error) {
    console.error('获取所有订单失败:', error);
    throw error;
  }
}

/**
 * 根据ID获取订单
 * @param {string} orderId - 订单ID
 * @returns {Promise<Object|null>} 订单对象或null
 */
async function getOrderById(orderId) {
  try {
    const result = await query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error(`获取订单(ID: ${orderId})失败:`, error);
    throw error;
  }
}

/**
 * 更新订单状态
 * @param {string} orderId - 订单ID
 * @param {string} newStatus - 新状态
 * @returns {Promise<Object|null>} 更新后的订单对象或null
 */
async function updateOrderStatus(orderId, newStatus) {

  const updateQuery = `UPDATE ${tableName} SET status = $1 WHERE order_id = $2 RETURNING *`;
  const queryParams = [newStatus, orderId];

  try {
    const result = await query(updateQuery, queryParams);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error(`更新订单(ID: ${orderId})状态为 '${newStatus}' 失败:`, error);
    throw error;
  }
}

/**
 * 更新订单
 * @param {string} orderId - 订单ID
 * @param {Object} updatedFields - 需要更新的字段
 * @returns {Promise<Object>} 更新后的订单对象
 */
async function updateOrder(orderNumber, updatedData, changedBy = 'system') {
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

    // 构建更新字段部分
    const updates = [];
    const values = [];
    const changes = {}; // 记录变更
    let paramIndex = 1;

    // 处理可更新字段
    const updateableFields = ['guest_name', 'phone', 'room_type',
                            'room_number', 'check_in_date', 'check_out_date',
                            'payment_method', 'total_price', 'deposit', 'remarks'];

    // 检查是否需要重新计算stay_type（如果日期发生变化）
    let shouldUpdateStayType = false;
    let newStayType = null;

    if (updatedData.check_in_date !== undefined || updatedData.check_out_date !== undefined) {
      // 使用新的日期或保持原有日期
      const newCheckInDate = updatedData.check_in_date || oldOrder.check_in_date;
      const newCheckOutDate = updatedData.check_out_date || oldOrder.check_out_date;

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
        updates.push(`${field} = $${paramIndex}`);
        values.push(updatedData[field]);
        changes[field] = {
          old: oldOrder[field],
          new: updatedData[field]
        };
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

    // 更新订单表 - 移除对 updated_at 的更新
    const updateQuery = `
      UPDATE ${tableName}
      SET ${updates.join(', ')}
      WHERE order_id = $${paramIndex}
      RETURNING *
    `;

    values.push(orderNumber);
    const { rows: [updatedOrder] } = await client.query(updateQuery, values);

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

    return updatedOrder;
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
 * 退押金
 * @param {Object} refundData - 退押金数据
 * @returns {Promise<Object>} 更新后的订单对象
 */
async function refundDeposit(refundData) {
  try {
    console.log('处理退押金请求:', refundData);

    // 获取订单信息
    const order = await getOrderById(refundData.order_id);

    if (!order) {
      console.log('！！！！获取订单失败');
      throw new Error(`订单号 '${refundData.order_id}' 不存在`);
    }

    // 验证订单状态（只有已退房或已取消的订单才能退押金）
    if (!['checked-out', 'cancelled'].includes(order.status)) {
      throw new Error('只有已退房或已取消的订单才能退押金');
    }

    refundData.change_type = '退押';
    refundData.change_price = -Math.abs(refundData.change_price || 0); // 确保为负数

    const billRes = await billModule.addBill(refundData)

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
 * 办理入住：创建每日账单并更新订单状态
 * @param {string} orderId - 订单ID
 * @returns {Promise<Object>} - 包含创建的账单和更新后的订单
 */
async function checkInOrder(orderId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. 获取订单信息
    const orderResult = await client.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
    const order = orderResult.rows[0];

    if (!order) {
      const err = new Error(`订单 (ID: ${orderId}) 未找到`);
      err.statusCode = 404;
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }

    // 2. 检查订单状态
    if (order.status !== 'pending') {
      const err = new Error(`订单状态为 '${order.status}'，无法办理入住`);
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_FOR_CHECK_IN';
      throw err;
    }

    // 3. 处理日期，确保正确解析数据库中的日期
    // 创建日期解析函数，避免时区问题
    const parseDBDate = (dateInput) => {
      if (!dateInput) return null;

      // 如果是字符串格式，优先按 YYYY-MM-DD 格式解析
      if (typeof dateInput === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          // YYYY-MM-DD 格式，创建本地日期
          const [year, month, day] = dateInput.split('-').map(Number);
          return new Date(year, month - 1, day);
        } else if (dateInput.includes('T')) {
          // ISO 格式，转换为本地日期（仅取日期部分）
          const isoDate = new Date(dateInput);
          return new Date(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate());
        }
      }

      // 兜底：直接使用 Date 构造函数
      return new Date(dateInput);
    };

    const checkInDate = parseDBDate(order.check_in_date);
    const checkOutDate = parseDBDate(order.check_out_date);

    console.log(`📅 [checkInOrder] 日期解析: 入住 ${order.check_in_date} -> ${checkInDate.toDateString()}, 退房 ${order.check_out_date} -> ${checkOutDate.toDateString()}`);

    // 4. 计算平均每日房价
    let nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    // 对于休息房等当天退房的情况（nights === 0），按1晚计算
    if (nights === 0) {
        console.log(`📝 [checkInOrder] 检测到休息房订单（同日入住退房），按1晚计算`);
        nights = 1;
    } else if (nights < 0) {
        // 退房日期早于入住日期，这是不合理的
        const err = new Error('退房日期不能早于入住日期');
        err.statusCode = 400;
        err.code = 'INVALID_NIGHTS';
        throw err;
    }

    const total_price = parseFloat(order.total_price);
    const averageDailyRate = total_price / nights;

    // 5. 生成每日账单
    const createdBills = [];

    // 创建本地日期格式化函数，避免时区问题
    const formatLocalDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    for (let i = 0; i < nights; i++) {
      const billDate = new Date(checkInDate);
      billDate.setDate(billDate.getDate() + i);
      const stayDateStr = formatLocalDate(billDate);

      console.log(`创建账单 ${i + 1}: 订单入住日期=${order.check_in_date}, 计算账单日期=${formatLocalDate(billDate)}, 存储日期=${stayDateStr}`);

      // 新版本：为每天创建独立的房费和押金账单记录

      // 1. 创建房费记录
      const roomFeeBill = {
        order_id: order.order_id,
        room_number: order.room_number,
        guest_name: order.guest_name,
        change_price: averageDailyRate,
        change_type: '房费',
        pay_way: order.payment_method,
        create_time: formatDateTimeForDB(),
        remarks: '办理入住创建',
        stay_type: order.stay_type,
        stay_date: stayDateStr
      };

      const insertRoomFeeBillQuery = `
        INSERT INTO bills (order_id, room_number, guest_name, change_price, change_type, pay_way, create_time, remarks, stay_type, stay_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;

      const roomFeeBillResult = await client.query(insertRoomFeeBillQuery, [
        roomFeeBill.order_id,
        roomFeeBill.room_number,
        roomFeeBill.guest_name,
        roomFeeBill.change_price,
        roomFeeBill.change_type,
        roomFeeBill.pay_way,
        roomFeeBill.create_time,
        roomFeeBill.remarks,
        roomFeeBill.stay_type,
        roomFeeBill.stay_date
      ]);
      createdBills.push(roomFeeBillResult.rows[0]);

      // 2. 仅在第一天创建押金记录
      if (i === 0 && order.deposit && Number(order.deposit) > 0) {
        const depositBill = {
          order_id: order.order_id,
          room_number: order.room_number,
          guest_name: order.guest_name,
          change_price: Number(order.deposit),
          change_type: '收押',
          pay_way: order.payment_method,
          create_time: formatDateTimeForDB(),
          remarks: '办理入住收押金',
          stay_type: order.stay_type,
          stay_date: stayDateStr
        };

        const insertDepositBillQuery = `
          INSERT INTO bills (order_id, room_number, guest_name, change_price, change_type, pay_way, create_time, remarks, stay_type, stay_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *;
        `;

        const depositBillResult = await client.query(insertDepositBillQuery, [
          depositBill.order_id,
          depositBill.room_number,
          depositBill.guest_name,
          depositBill.change_price,
          depositBill.change_type,
          depositBill.pay_way,
          depositBill.create_time,
          depositBill.remarks,
          depositBill.stay_type,
          depositBill.stay_date
        ]);
        createdBills.push(depositBillResult.rows[0]);
      }
    }

    // 5. 更新订单状态
    const updateOrderQuery = `UPDATE orders SET status = 'checked-in' WHERE order_id = $1 RETURNING *;`;
    const updatedOrderResult = await client.query(updateOrderQuery, [orderId]);
    const updatedOrder = updatedOrderResult.rows[0];

    await client.query('COMMIT');

    return { createdBills, updatedOrder };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`办理入住事务失败 (订单ID: ${orderId}):`, error);
    // 传递已有的 statusCode 和 code，否则抛出通用错误
    if (!error.statusCode) {
        error.statusCode = 500;
        error.message = '办理入住时发生服务器内部错误';
    }
    throw error;
  } finally {
    client.release();
  }
}

const table = {
  checkTableExists,
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateOrder,
  refundDeposit,
  getDepositStatus,
  isRestRoom,
  calculateTotalPrice,
  validatePriceDateRange,
  checkInOrder
};

/**
 * 快速入住：在一个事务中创建已入住订单和相应账单
 * @param {Object} orderData - 前端传递的订单数据
 * @param {string} createdBy - 操作员用户名
 * @returns {Promise<Object>} - 包含创建的订单和账单
 */
async function createCheckedInOrderWithTransaction(orderData, createdBy = 'system') {
  // 1. 数据预处理和验证
  console.log('🚀 [fastCheckIn] 开始快速入住流程, 操作人:', createdBy);
  console.log('🛠️ [fastCheckIn] 输入原始数据:', JSON.stringify(orderData, null, 2));

  // 强制设置订单状态为 'checked-in'
  const dataForCreation = { ...orderData, status: 'checked-in' };

  // 复用 createOrder 内部的验证逻辑
  validateOrderData(dataForCreation);
  console.log('✅ [fastCheckIn] 基础验证通过');

  // 根据日期计算住宿类型
  const stay_type = isRestRoom(dataForCreation) ? '休息房' : '客房';
  dataForCreation.stay_type = stay_type;
  console.log(`🏠 [fastCheckIn] 自动设置住宿类型: ${stay_type}`);

  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');
    console.log('事务开始');

    // 2. 复用 createOrder 内部的冲突和可用性检查
    const existingOrder = await checkExistingOrder(dataForCreation);
    if (existingOrder) {
      const error = new Error('订单重复');
      error.code = 'DUPLICATE_ORDER';
      error.statusCode = 409;
      error.existingOrder = existingOrder;
      throw error;
    }

    const roomQuery = 'SELECT * FROM rooms WHERE room_number = $1';
    const roomResult = await client.query(roomQuery, [dataForCreation.room_number]);
    if (roomResult.rows.length === 0) {
      const error = new Error(`房间号 '${dataForCreation.room_number}' 不存在`);
      error.code = 'INVALID_ROOM_NUMBER';
      error.statusCode = 400;
      throw error;
    }
    if (roomResult.rows[0].is_closed) {
      const error = new Error(`房间 '${dataForCreation.room_number}' 已关闭，无法预订`);
      error.code = 'ROOM_CLOSED';
      error.statusCode = 400;
      throw error;
    }

    const conflictQuery = `
        SELECT * FROM orders
        WHERE room_number = $1
        AND status NOT IN ('cancelled', 'checked-out')
        AND check_in_date < $2
        AND check_out_date > $3
      `;
    const conflictParams = [
        dataForCreation.room_number,
        dataForCreation.check_out_date,
        dataForCreation.check_in_date
      ];
    const conflictResult = await client.query(conflictQuery, conflictParams);
    if (conflictResult.rows.length > 0) {
        const error = new Error(`房间 '${dataForCreation.room_number}' 在指定日期已被预订`);
        error.code = 'ROOM_ALREADY_BOOKED';
        error.statusCode = 409;
        throw error;
    }
    console.log('✅ [fastCheckIn] 冲突和可用性检查通过');

    // 3. 创建订单
    const {
      order_id, id_source, order_source, guest_name, phone,
      room_type, room_number, check_in_date, check_out_date, status,
      payment_method, total_price, deposit, create_time, remarks
    } = dataForCreation;

    const formattedCheckInDate = formatDate(check_in_date);
    const formattedCheckOutDate = formatDate(check_out_date);

    const insertOrderQuery = `
      INSERT INTO orders (
        order_id, id_source, order_source, guest_name, phone,
        room_type, room_number, check_in_date, check_out_date, status,
        payment_method, total_price, deposit, create_time, stay_type, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *;
    `;
    const orderValues = [
      order_id, id_source, order_source, guest_name, phone || '',
      room_type, room_number, formattedCheckInDate, formattedCheckOutDate, status,
      payment_method, calculateTotalPrice(total_price), deposit, formatDateTimeForDB(create_time), stay_type, remarks
    ];

    const orderResult = await client.query(insertOrderQuery, orderValues);
    const newOrder = orderResult.rows[0];
    console.log('✅ [fastCheckIn] 订单创建成功, order_id:', newOrder.order_id);

    // 4. 创建账单 - 按每日创建房费账单
    const createdBills = [];

    // 4.1 计算住宿天数
    const checkInDate = new Date(newOrder.check_in_date);
    const checkOutDate = new Date(newOrder.check_out_date);
    let stayDays = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    // 对于休息房等当天退房的情况（stayDays === 0），按1天计算
    if (stayDays === 0) {
      console.log(`📝 [fastCheckIn] 检测到休息房订单（同日入住退房），按1天计算`);
      stayDays = 1;
    } else if (stayDays < 0) {
      const error = new Error('退房日期不能早于入住日期');
      error.code = 'INVALID_DATES';
      error.statusCode = 400;
      throw error;
    }

    console.log(`🧮 [fastCheckIn] stayDays: ${stayDays}, total_price: ${newOrder.total_price}`);

    // 4.2 计算每日房费（平均分摊）
    const dailyPrice = stayDays > 0 ? Number((Number(newOrder.total_price) / stayDays).toFixed(2)) : 0;

    // 4.3 为每一天创建房费账单
    for (let i = 0; i < stayDays; i++) {
      const stayDateEach = new Date(checkInDate);
      stayDateEach.setDate(checkInDate.getDate() + i);
      const stayDateStr = formatDate(stayDateEach);

      const roomFeeBillResult = await client.query(
        `INSERT INTO bills (order_id, room_number, guest_name, change_price, change_type, pay_way, create_time, remarks, stay_type, stay_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          newOrder.order_id,
          String(newOrder.room_number).slice(0, 10),
          newOrder.guest_name,
          dailyPrice,
          setup.changeType.roomFee,
          newOrder.payment_method,
          formatDateTimeForDB(),
          `第 ${i + 1} 天房费`,
          newOrder.stay_type,
          stayDateStr
        ]
      );
      createdBills.push(roomFeeBillResult.rows[0]);
    }
    console.log(`✅ [fastCheckIn] 创建了 ${stayDays} 条房费账单`);

    // 4.4 如果有押金，插入押金账单（仅在第一天创建）
    const actualDeposit = Number(newOrder.deposit || 0);
    if (actualDeposit > 0) {
      const firstDayDate = formatDate(newOrder.check_in_date);
      const depositBillResult = await client.query(
        `INSERT INTO bills (order_id, room_number, guest_name, change_price, change_type, pay_way, create_time, remarks, stay_type, stay_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          newOrder.order_id,
          String(newOrder.room_number).slice(0, 10),
          newOrder.guest_name,
          actualDeposit,
          setup.changeType.deposit,
          newOrder.payment_method,
          formatDateTimeForDB(),
          '快速入住-押金',
          newOrder.stay_type,
          firstDayDate
        ]
      );
      createdBills.push(depositBillResult.rows[0]);
      console.log('✅ [fastCheckIn] 押金账单创建成功');
    }

    // 5. 更新房间状态为 'occupied'
    await client.query("UPDATE rooms SET status = 'occupied' WHERE room_number = $1", [newOrder.room_number]);
    console.log(`✅ [fastCheckIn] 房间 ${newOrder.room_number} 状态更新为 occupied`);

    await client.query('COMMIT');
    console.log('✅ [fastCheckIn] 事务提交成功');

    return { order: newOrder, bills: createdBills };

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('❌ [fastCheckIn] 事务回滚:', error.message);
    // 保持与路由层一致的错误抛出格式
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    if (!error.code) {
        if (/价格|日期|电话号码|押金|房型|房间号|预订|关闭/.test(error.message)) {
            error.code = 'VALIDATION_ERROR';
            error.statusCode = 400;
        } else {
            error.code = 'TRANSACTION_FAILED';
        }
    }
    throw error;
  } finally {
    if (client) {
      client.release();
      console.log('数据库连接已释放');
    }
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
          updates.push(`${field} = $${paramIndex}`);
          orderValues.push(updatedData[field]);
          changes[field] = {
            old: oldOrder[field],
            new: updatedData[field]
          };
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


// 添加新函数到导出对象
table.updateOrderWithBills = updateOrderWithBills;
table.createCheckedInOrderWithTransaction = createCheckedInOrderWithTransaction;

module.exports = table;
