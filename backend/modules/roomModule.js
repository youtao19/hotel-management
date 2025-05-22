"use strict";
const { query } = require('../database/postgreDB/pg');
/**
 * 获取所有房间
 * @returns {Promise<Array>} 所有房间列表
 */
async function getAllRooms() {
  try {
    // 使用两次查询，先获取全部房间，然后获取已有订单的房间，最后合并数据
    // 这样可以确保不会漏掉任何房间

    // 1. 获取所有房间的基本信息
    console.log('开始获取房间基本信息...');
    const roomsResult = await query('SELECT * FROM rooms ORDER BY room_number');
    console.log(`查询到 ${roomsResult.rows.length} 个房间`);

    const allRooms = roomsResult.rows;

    // 2. 获取房间与当前有效订单的关联信息
    console.log('开始获取房间关联的订单信息...');
    const ordersSQL = `
      SELECT DISTINCT ON (o.room_number)
        o.room_number,
        o.guest_name,
        o.check_out_date,
        o.status as order_status,
        o.order_id
      FROM orders o
      WHERE o.status IN ('pending', 'checked-in')
      ORDER BY o.room_number, o.create_time DESC
    `;

    const ordersResult = await query(ordersSQL);
    console.log(`查询到 ${ordersResult.rows.length} 个活跃订单`);

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
    console.log('房间数据处理完成:');
    console.log('- 总房间数量:', allRooms.length);
    console.log('- 有订单的房间数量:', ordersResult.rows.length);
    console.log('- 合并后的房间数量:', mergedRooms.length);
    console.log('- 可用房间数量:', mergedRooms.filter(r => r.status === 'available' && !r.order_status).length);

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

/**
 * 检查指定日期范围内的可用房间
 * @param {string} startDate - 入住日期 YYYY-MM-DD
 * @param {string} endDate - 退房日期 YYYY-MM-DD
 * @param {string} [typeCode] - 可选的房型代码
 * @returns {Promise<Array>} 可用房间列表
 */
async function getAvailableRooms(startDate, endDate, typeCode = null) {
  try {
    console.log('查询可用房间:', { startDate, endDate, typeCode });

    // 确保日期格式正确（去除可能的时区信息）
    startDate = startDate.split('T')[0];
    endDate = endDate.split('T')[0];

    // 构建基础查询
    let baseQuery = `
      SELECT DISTINCT r.*
      FROM rooms r
      WHERE r.is_closed = false
      AND r.status NOT IN ('repair', 'cleaning')
      AND NOT EXISTS (
        SELECT 1
        FROM orders o
        WHERE o.room_number = r.room_number
        AND o.status IN ('pending', 'checked-in')
        AND $1::date < o.check_out_date::date
        AND $2::date > o.check_in_date::date
      )
    `;

    const queryParams = [startDate, endDate];

    // 如果指定了房型，添加房型过滤条件
    if (typeCode) {
      baseQuery += ' AND r.type_code = $3';
      queryParams.push(typeCode);
    }

    // 按房间号排序
    baseQuery += ' ORDER BY r.room_number';

    console.log('执行SQL查询:', baseQuery);
    console.log('查询参数:', queryParams);

    const result = await query(baseQuery, queryParams);
    console.log(`找到 ${result.rows.length} 个可用房间`);

    // 添加日志：打印可用房间的房间号
    if (result.rows.length > 0) {
      console.log('可用房间号列表:', result.rows.map(room => room.room_number));
    } else {
      console.log('没有找到符合条件的可用房间。');
    }

    return result.rows;
  } catch (error) {
    console.error('查询可用房间失败:', error);
    throw error;
  }
}

// 导出表定义和功能函数
module.exports = {
  getAllRooms,
  getRoomById,
  getRoomByNumber,
  updateRoomStatus,
  addRoom,
  getAllRoomTypes,
  getAvailableRooms
};
