// 房间数据表操作模块
"use strict";

// 从pg.js获取查询函数而不是直接导入pool对象
const { query } = require('../pg');

// 表名常量
const tableName = "rooms";

// 创建表的SQL语句
const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    room_id INT PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    type_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
  );
`;

// 创建索引的SQL语句
const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_rooms_number ON ${tableName} (room_number);`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_status ON ${tableName} (status);`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_type ON ${tableName} (type_code);`
];

/**
 * 获取所有房间
 * @returns {Promise<Array>} 所有房间列表
 */
async function getAllRooms() {
  try {
    // 使用两次查询，先获取全部房间，然后获取已有订单的房间，最后合并数据
    // 这样可以确保不会漏掉任何房间

    // 1. 获取所有房间的基本信息
    const roomsResult = await query('SELECT * FROM rooms ORDER BY room_number');
    const allRooms = roomsResult.rows;

    // 2. 获取房间与当前有效订单的关联信息
    const ordersSQL = `
      SELECT DISTINCT ON (o.room_number)
        o.room_number,
        o.guest_name,
        o.check_out_date,
        o.status as order_status,
        o.order_id
      FROM orders o
      WHERE o.status IN ('待入住', '已入住')
      ORDER BY o.room_number, o.create_time DESC
    `;

    const ordersResult = await query(ordersSQL);
    const ordersByRoom = {};

    // 创建房间号到订单的映射
    ordersResult.rows.forEach(order => {
      ordersByRoom[order.room_number] = order;
    });

    // 合并房间数据和订单数据
    const mergedRooms = allRooms.map(room => {
      const order = ordersByRoom[room.room_number];
      if (order) {
        return {
          ...room,
          guest_name: order.guest_name,
          check_out_date: order.check_out_date,
          order_status: order.order_status,
          order_id: order.order_id
        };
      }
      return room;
    });

    // 添加调试日志
    console.log('总房间数量:', allRooms.length);
    console.log('有订单的房间数量:', ordersResult.rows.length);
    console.log('合并后的房间数据示例:', mergedRooms.slice(0, 3));

    // 记录有订单状态的房间
    const roomsWithOrders = mergedRooms.filter(room => room.order_status);
    if (roomsWithOrders.length > 0) {
      console.log('已关联订单的房间示例:',
        roomsWithOrders.slice(0, 3).map(room => ({
          room_number: room.room_number,
          status: room.status,
          order_status: room.order_status,
          guest_name: room.guest_name
        }))
      );
    }

    return mergedRooms;
  } catch (error) {
    console.error('获取所有房间失败:', error);
    throw error;
  }
}

/**
 * 根据ID获取房间
 * @param {number} id - 房间ID
 * @returns {Promise<Object|null>} 房间对象或null
 */
async function getRoomById(id) {
  try {
    const { rows } = await query('SELECT * FROM rooms WHERE room_id = $1', [id]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error(`获取房间(ID: ${id})失败:`, error);
    throw error;
  }
}

/**
 * 根据房间号获取房间
 * @param {string} number - 房间号
 * @returns {Promise<Object|null>} 房间对象或null
 */
async function getRoomByNumber(number) {
  try {
    const { rows } = await query('SELECT * FROM rooms WHERE room_number = $1', [number]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error(`获取房间(房间号: ${number})失败:`, error);
    throw error;
  }
}

/**
 * 更新房间状态并自动处理房间可用性
 * @param {number} id - 房间ID
 * @param {string} status - 新状态
 * @returns {Promise<Object|null>} 更新后的房间对象或null
 */
async function updateRoomStatus(id, status) {
  try {
    console.log(`更新房间(ID: ${id})状态为: ${status}`);

    // 直接使用传入的状态值，不做转换
    let isClosed = false;

    // 根据状态自动设置房间的is_closed字段
    if (status === 'repair' || status === 'cleaning') {
      console.log(`设置房间 ${id} 为关闭状态(is_closed=true)`);
      isClosed = true; // 维修中或清洁中的房间设为关闭状态
    } else {
      console.log(`设置房间 ${id} 为开放状态(is_closed=false)`);
    }

    // 执行房间状态更新，同时更新is_closed字段
    console.log(`执行SQL: UPDATE rooms SET status = '${status}', is_closed = ${isClosed} WHERE room_id = ${id}`);
    const { rows } = await query(
      'UPDATE rooms SET status = $1, is_closed = $2 WHERE room_id = $3 RETURNING *',
      [status, isClosed, id]
    );

    if (rows.length > 0) {
      console.log(`更新成功，结果:`, rows[0]);
    } else {
      console.log(`未找到ID为 ${id} 的房间`);
    }
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error(`更新房间(ID: ${id})状态失败:`, error);
    throw error;
  }
}

/**
 * 添加新房间
 * @param {Object} roomData - 房间数据对象
 * @returns {Promise<Object>} 新添加的房间对象
 */
async function addRoom(roomData) {
  const { room_number, type_code, status, price } = roomData;

  try {
    // 检查房间号是否已存在
    const checkResult = await query('SELECT * FROM rooms WHERE room_number = $1', [room_number]);
    if (checkResult.rows.length > 0) {
      throw new Error('房间号已存在');
    }

    // 获取新ID
    const idResult = await query('SELECT MAX(room_id) as max_id FROM rooms');
    const newId = (idResult.rows[0].max_id || 0) + 1;

    // 插入新房间
    const { rows } = await query(
      'INSERT INTO rooms (room_id, room_number, type_code, status, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [newId, room_number, type_code, status, price]
    );

    return rows[0];
  } catch (error) {
    console.error('添加房间失败:', error);
    throw error;
  }
}

/**
 * 获取所有房型
 * @returns {Promise<Array>} 所有房型列表
 */
async function getAllRoomTypes() {
  try {
    const { rows } = await query('SELECT * FROM room_types');
    return rows;
  } catch (error) {
    console.error('获取所有房型失败:', error);
    throw error;
  }
}

// 导出表定义和功能函数
module.exports = {
  tableName,
  createQuery,
  createIndexQueryStrings,
  getAllRooms,
  getRoomById,
  getRoomByNumber,
  updateRoomStatus,
  addRoom,
  getAllRoomTypes
};
