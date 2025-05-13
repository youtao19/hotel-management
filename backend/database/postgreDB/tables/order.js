"use strict";
const { query } = require('../pg'); // 修改导入以使用query函数而不是pool对象

const tableName = "orders";

const dataShape = {
    order_id: "ORD00000001", // VARCHAR(20) PRIMARY KEY
    id_source: "some_external_id_or_platform_id", // VARCHAR(50)
    order_source: "Online", // VARCHAR(20)
    guest_name: "John Doe", // VARCHAR(50)
    phone: "13800138000", // VARCHAR(20)
    id_number: "123456789012345678", // VARCHAR(30)
    room_type: "SINGLE", // VARCHAR(20)
    room_number: "101", // VARCHAR(10)
    check_in_date: new Date(), // DATE
    check_out_date: new Date(new Date().setDate(new Date().getDate() + 1)), // DATE
    status: "PENDING", // VARCHAR(10)
    payment_method: "Alipay", // VARCHAR(10)
    room_price: 200.00, // DECIMAL(10,2)
    deposit: 100.00, // DECIMAL(10,2)
    create_time: new Date(), // TIMESTAMP
    actual_check_in_time: null, // TIMESTAMP
    actual_check_out_time: null, // TIMESTAMP
    remarks: "Needs a quiet room." // TEXT
};

const createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
    order_id VARCHAR(20) PRIMARY KEY,
    id_source VARCHAR(50),
    order_source VARCHAR(20) NOT NULL,
    guest_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    id_number VARCHAR(30) NOT NULL,
    room_type VARCHAR(20) NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(20),
    room_price DECIMAL(10,2) NOT NULL,
    deposit DECIMAL(10,2),
    create_time TIMESTAMP NOT NULL,
    actual_check_in_time TIMESTAMP,
    actual_check_out_time TIMESTAMP,
    remarks TEXT,
    FOREIGN KEY (room_type) REFERENCES room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number)
)`;

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const createIndexQueryStrings = [
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON ${tableName}(status)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_check_dates ON ${tableName}(check_in_date, check_out_date)`
];

async function createOrder(orderData) {
  const {
    order_id, id_source, order_source, guest_name, phone, id_number,
    room_type, room_number, check_in_date, check_out_date, status,
    payment_method, room_price, deposit, create_time,
    actual_check_in_time, actual_check_out_time, remarks
  } = orderData;

  // 注意：字段名与 db_schema.sql 中的 orders 表完全对应
  const query = `
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
    const result = await query(query, values);
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
  tableName,
  dataShape,
  createQuery,
  dropQuery,
  createIndexQueryStrings,
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus
};

module.exports = table;
