const { query, getClient } = require('../database/postgreDB/pg');
const shiftHandoverModule = require('./shiftHandoverModule');
const billModule = require('./billModule');

const tableName = "orders";

// 定义有效的订单状态
const VALID_ORDER_STATES = ['pending', 'checked-in', 'checked-out', 'cancelled'];

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
  const { guest_name, check_in_date, check_out_date, room_type } = orderData;

  const checkQuery = `
    SELECT * FROM ${tableName}
    WHERE guest_name = $1
    AND check_in_date = $2
    AND check_out_date = $3
    AND room_type = $4
    AND status NOT IN ('cancelled', 'checked-out')
  `;

  const result = await query(checkQuery, [guest_name, check_in_date, check_out_date, room_type]);
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
      throw new Error('该客人在相同时间段已有相同类型的房间预订');
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
 * 计算订单总价格
 * @param {Object|number} roomPrice - 房间价格数据（JSONB对象或数字）
 * @returns {number} 总价格
 */
function calculateTotalPrice(roomPrice) {
  if (typeof roomPrice === 'number') {
    return roomPrice;
  }

  if (typeof roomPrice === 'object' && roomPrice !== null) {
    return Object.values(roomPrice).reduce((sum, price) => sum + parseFloat(price), 0);
  }

  return 0;
}

/**
 * 验证价格日期范围
 * @param {Object} roomPrice - 房间价格对象
 * @param {string} checkInDate - 入住日期
 * @param {string} checkOutDate - 退房日期
 * @returns {Object} 验证结果 {isValid: boolean, message?: string}
 */
function validatePriceDateRange(roomPrice, checkInDate, checkOutDate) {
  if (typeof roomPrice !== 'object' || roomPrice === null) {
    return { isValid: true };
  }

  const priceDates = Object.keys(roomPrice).sort();
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
    { field: 'phone', name: '联系电话' },
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

  // 4. 验证电话号码格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(orderData.phone)) {
    const error = new Error('无效的电话号码格式');
    error.code = 'INVALID_PHONE_FORMAT';
    throw error;
  }

  // 5. 验证价格和押金
  // 使用 !== undefined 判断，确保 0 这样的值也进入验证分支
  if (orderData.room_price !== undefined) {
    if (typeof orderData.room_price === 'object') {
      // JSON格式验证：验证每个日期的价格
      const prices = Object.values(orderData.room_price);
      const dates = Object.keys(orderData.room_price);

      if (prices.length === 0) {
        const error = new Error('房间价格不能为空');
        error.code = 'INVALID_PRICE_EMPTY';
        throw error;
      }

      if (prices.some(price => !price || parseFloat(price) <= 0)) {
        const error = new Error('所有日期的房间价格必须大于0');
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
        orderData.room_price,
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
      const numericPrice = parseFloat(orderData.room_price);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        const error = new Error('房间价格必须大于0');
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
  console.log('🛠️ [createOrder] 输入原始数据:', JSON.stringify(orderData, null, 2));
    // 1. 数据验证
    validateOrderData(orderData);
  console.log('✅ [createOrder] 基础验证通过');

    // 2. 检查是否存在重复订单
    const existingOrder = await checkExistingOrder(orderData);
    if (existingOrder) {
      const error = new Error('订单重复');
      error.code = 'DUPLICATE_ORDER';
      error.existingOrder = existingOrder;
      throw error;
    }

    // 3. 验证房型是否存在
    const roomTypeQuery = 'SELECT * FROM room_types WHERE type_code = $1';
    const roomTypeResult = await query(roomTypeQuery, [orderData.room_type]);
    if (roomTypeResult.rows.length === 0) {
      const error = new Error(`房型 '${orderData.room_type}' 不存在`);
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
      order_id, id_source, order_source, guest_name, phone, id_number,
      room_type, room_number, check_in_date, check_out_date, status,
      payment_method, room_price, deposit, create_time, remarks
    } = orderData;

    // 6.1. 根据入住退房日期自动设置住宿类型
    const stay_type = isCurrentOrderRestRoom ? '休息房' : '客房';
    console.log(`🏠 [createOrder] 自动设置住宿类型: ${stay_type} (基于日期: ${check_in_date} -> ${check_out_date})`);

    // 如果前端传入了stay_type，检查是否与计算结果一致
    if (orderData.stay_type && orderData.stay_type !== stay_type) {
      console.warn(`⚠️ [createOrder] 前端传入的住宿类型 "${orderData.stay_type}" 与计算结果 "${stay_type}" 不一致，以计算结果为准`);
    }

    // 7. 处理房间价格数据
    let processedRoomPrice = room_price;

    // 数字或数字字符串 -> 转换为以入住日为key的对象
    if (typeof room_price === 'number' || (typeof room_price === 'string' && room_price.trim() !== '' && !isNaN(parseFloat(room_price)))) {
      processedRoomPrice = {
        [check_in_date]: parseFloat(room_price)
      };
    } else if (typeof room_price === 'string' && room_price.trim().startsWith('{')) {
      // JSON字符串 -> 解析为对象
      try {
        processedRoomPrice = JSON.parse(room_price);
      } catch (e) {
        const err = new Error('价格数据格式无效，无法解析');
        err.code = 'INVALID_PRICE_JSON';
        throw err;
      }
    }

    // 确保是有效的JSON对象
    if (typeof processedRoomPrice === 'object' && processedRoomPrice !== null) {
      // 验证价格数据的日期范围是否合理
      const priceStartDate = Math.min(...Object.keys(processedRoomPrice).map(d => new Date(d).getTime()));
      const priceEndDate = Math.max(...Object.keys(processedRoomPrice).map(d => new Date(d).getTime()));
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

    // 9. 执行数据库插入操作

    const insertQuery = `
      INSERT INTO orders (
        order_id, id_source, order_source, guest_name, phone, id_number,
        room_type, room_number, check_in_date, check_out_date, status,
        payment_method, room_price, deposit, create_time, stay_type, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, $17
      )
      RETURNING *;
    `;

    const values = [
      order_id, id_source, order_source, guest_name, phone, id_number,
      room_type, room_number, check_in_date, check_out_date, status,
      payment_method, JSON.stringify(processedRoomPrice), deposit, create_time || new Date(), stay_type, processedRemarks
    ];

  console.log('🗃️ [createOrder] 即将插入 values:', values.map(v => (typeof v === 'string' && v.length > 120 ? v.slice(0,120)+'…' : v)));
  const result = await query(insertQuery, values);
  console.log('✅ [createOrder] 插入成功 order_id=', result.rows[0]?.order_id);
    return result.rows[0];

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
  // 验证订单状态
  if (!isValidOrderStatus(newStatus)) {
    throw new Error(`无效的订单状态: ${newStatus}。有效状态: ${VALID_ORDER_STATES.join(', ')}`);
  }

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
    const updateableFields = ['guest_name', 'phone', 'id_number', 'room_type',
                            'room_number', 'check_in_date', 'check_out_date',
                            'payment_method', 'room_price', 'deposit', 'remarks'];

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
  updateOrder
};

module.exports = table;
