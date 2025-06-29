const { query } = require('../database/postgreDB/pg');

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
    AND status != '已取消'
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
  const checkInDate = new Date(orderData.check_in_date);
  const checkOutDate = new Date(orderData.check_out_date);

  // 比较日期部分，忽略时间
  const checkInDateStr = checkInDate.toISOString().split('T')[0];
  const checkOutDateStr = checkOutDate.toISOString().split('T')[0];

  return checkInDateStr === checkOutDateStr;
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

  // 5. 验证价格和押金为正数
  if (orderData.room_price && parseFloat(orderData.room_price) <= 0) {
    const error = new Error('房间价格必须大于0');
    error.code = 'INVALID_PRICE';
    throw error;
  }

  if (orderData.deposit && parseFloat(orderData.deposit) <= 0) {
    const error = new Error('押金必须大于0');
    error.code = 'INVALID_DEPOSIT';
    throw error;
  }
}

/**
 * 创建新订单
 * @param {Object} orderData 订单数据
 * @returns {Promise<Object>} 创建的订单
 */
async function createOrder(orderData) {
  try {
    // 1. 数据验证
    validateOrderData(orderData);

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
      // 休息房冲突检查：同一天同一房间不能有其他订单
      conflictQuery = `
        SELECT * FROM orders
        WHERE room_number = $1
        AND status != '已取消'
        AND (
          (check_in_date = $2) OR
          (check_out_date = $2) OR
          (check_in_date < $2 AND check_out_date > $2)
        )
      `;
      conflictParams = [orderData.room_number, orderData.check_in_date];
    } else {
      // 普通订单冲突检查：日期区间重叠
      conflictQuery = `
        SELECT * FROM orders
        WHERE room_number = $1
        AND status != '已取消'
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

    // 6. 处理休息房备注
    let processedRemarks = remarks || '';
    if (isCurrentOrderRestRoom) {
      // 确保休息房订单在备注中有标识
      if (!processedRemarks.includes('【休息房】')) {
        processedRemarks = '【休息房】' + (processedRemarks ? ' ' + processedRemarks : '');
      }
    }

    // 7. 插入订单数据
    const {
      order_id, id_source, order_source, guest_name, phone, id_number,
      room_type, room_number, check_in_date, check_out_date, status,
      payment_method, room_price, deposit, create_time, remarks
    } = orderData;

    const insertQuery = `
      INSERT INTO orders (
        order_id, id_source, order_source, guest_name, phone, id_number,
        room_type, room_number, check_in_date, check_out_date, status,
        payment_method, room_price, deposit, create_time, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *;
    `;

    const values = [
      order_id, id_source, order_source, guest_name, phone, id_number,
      room_type, room_number, check_in_date, check_out_date, status,
      payment_method, room_price, deposit, create_time || new Date(), processedRemarks
    ];

    const result = await query(insertQuery, values);
    return result.rows[0];

  } catch (error) {
    console.error('创建订单失败:', error);
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

const table = {
  checkTableExists,
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  isRestRoom
};

module.exports = table;
