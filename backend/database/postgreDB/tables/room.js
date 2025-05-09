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
    room_number VARCHAR(10) NOT NULL UNIQUE,
    type_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
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
    const { rows } = await query('SELECT * FROM rooms');
    return rows;
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
 * 更新房间状态
 * @param {number} id - 房间ID
 * @param {string} status - 新状态
 * @returns {Promise<Object|null>} 更新后的房间对象或null
 */
async function updateRoomStatus(id, status) {
  try {
    const { rows } = await query(
      'UPDATE rooms SET status = $1 WHERE room_id = $2 RETURNING *',
      [status, id]
    );
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
