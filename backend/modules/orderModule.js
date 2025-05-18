const { query } = require('../database/postgreDB/pg');

const tableName = "orders";

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
 * 创建新订单
 * @param {Object} orderData - 订单数据对象
 * @param {string} orderData.order_id - 订单编号
 * @param {string} orderData.id_source - 身份证来源
 * @param {string} orderData.order_source - 订单来源
 * @param {string} orderData.guest_name - 客人姓名
 * @param {string} orderData.phone - 联系电话
 * @param {string} orderData.id_number - 身份证号
 * @param {string} orderData.room_type - 房型
 * @param {string} orderData.room_number - 房间号
 * @param {Date} orderData.check_in_date - 预计入住日期
 * @param {Date} orderData.check_out_date - 预计退房日期
 * @param {string} orderData.status - 订单状态
 * @param {string} orderData.payment_method - 支付方式
 * @param {number} orderData.room_price - 房间价格
 * @param {number} orderData.deposit - 押金
 * @param {Date} orderData.create_time - 创建时间
 * @param {Date} orderData.actual_check_in_time - 实际入住时间
 * @param {Date} orderData.actual_check_out_time - 实际退房时间
 * @param {string} orderData.remarks - 备注
 * @returns {Promise<Object>} 返回创建的订单对象
 */
async function createOrder(orderData) {
  const {
    order_id, id_source, order_source, guest_name, phone, id_number,
    room_type, room_number, check_in_date, check_out_date, status,
    payment_method, room_price, deposit, create_time,
    actual_check_in_time, actual_check_out_time, remarks
  } = orderData;

  // 注意：字段名与 db_schema.sql 中的 orders 表完全对应
  const sqlQuery = `
    INSERT INTO ${tableName} (
      order_id, id_source, order_source, guest_name, phone, id_number,
      room_type, room_number, check_in_date, check_out_date, status,
      payment_method, room_price, deposit, create_time,
      actual_check_in_time, actual_check_out_time, remarks
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    )
    RETURNING *;
  `;

  const values = [
    order_id, id_source, order_source, guest_name, phone, id_number,
    room_type, room_number, check_in_date, check_out_date, status,
    payment_method, room_price, deposit, create_time,
    actual_check_in_time, actual_check_out_time, remarks
  ];

  try {
    const result = await query(sqlQuery, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating order in DB:', error);
    // 检查是否是外键约束错误，例如房间号不存在或房间类型不存在
    if (error.code === '23503') { // PostgreSQL 外键违反错误码
        if (error.constraint === 'orders_room_number_fkey') {
            throw new Error(`房间号 '${room_number}' 不存在或无效。`);
        }
        if (error.constraint === 'orders_room_type_fkey') {
            throw new Error(`房型 '${room_type}' 不存在或无效。`);
        }
        throw new Error('创建订单失败：关联数据不存在。' + error.detail);
    }
    // 检查是否是唯一约束错误，例如订单号已存在
    if (error.code === '23505') { // PostgreSQL 唯一约束违反错误码
        if (error.constraint === 'orders_pkey') {
             throw new Error(`订单号 '${order_id}' 已存在。`);
        }
        throw new Error('创建订单失败：数据已存在。' + error.detail);
    }
    throw error; // 其他类型的数据库错误
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
  try {
    const result = await query(
      'UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *',
      [newStatus, orderId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error(`更新订单(ID: ${orderId})状态失败:`, error);
    throw error;
  }
}

const table = {
  checkTableExists,
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus
};

module.exports = table;