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
    console.log('[Backend INFO] getAvailableRooms: 函数入口，原始参数:', { startDate, endDate, typeCode });

    // 确保日期格式正确（去除可能的时区信息，并假定输入是 YYYY-MM-DD）
    const queryStartDate = startDate.split('T')[0];
    const queryEndDate = endDate.split('T')[0];
    console.log('[Backend INFO] getAvailableRooms: 处理后的查询日期:', { queryStartDate, queryEndDate });

    let sqlQuery = `
      SELECT r.room_id, r.room_number, r.type_code, r.status, r.price, r.is_closed
      FROM rooms r
      WHERE
        r.is_closed = FALSE
        AND NOT EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.room_number = r.room_number
            AND o.status IN ('pending', 'checked-in')
            AND o.check_in_date < $2::date       -- Query End Date
            AND o.check_out_date > $1::date    -- Query Start Date
        )
    `;

    const queryParams = [queryStartDate, queryEndDate];

    if (typeCode) {
      sqlQuery += ` AND r.type_code = $${queryParams.length + 1}::varchar`;
      queryParams.push(typeCode);
      console.log('[Backend INFO] getAvailableRooms: 添加了房型筛选 typeCode:', typeCode);
    } else {
      console.log('[Backend INFO] getAvailableRooms: 未指定房型筛选 typeCode.');
    }

    sqlQuery += ' ORDER BY r.room_number;';

    console.log('[Backend DEBUG] getAvailableRooms: 最终执行的SQL:\n', sqlQuery);
    console.log('[Backend DEBUG] getAvailableRooms: SQL参数:', queryParams);

    const result = await query(sqlQuery, queryParams);
    const availableRooms = result.rows;

    console.log(`[Backend INFO] getAvailableRooms: 数据库查询完毕，找到 ${availableRooms.length} 个符合条件的房间.`);

    if (availableRooms.length > 0) {
      console.log('[Backend INFO] getAvailableRooms: 可用房间号列表:', availableRooms.map(room => room.room_number).join(', '));
    } else {
      console.log('[Backend INFO] getAvailableRooms: 没有找到符合条件的可用房间。');
    }

    // 如果需要更详细的调试，可以取消注释下面的部分，它会检查为什么某些房间不可用
    /*
    if (availableRooms.length === 0 && (queryStartDate === '你的特定测试开始日期' && queryEndDate === '你的特定测试结束日期')) {
      console.log('[Backend DEBUG] getAvailableRooms: 特定日期查询无结果，开始诊断...');
      const allPotentiallyOpenRooms = await query('SELECT room_id, room_number, type_code, status, is_closed FROM rooms WHERE is_closed = FALSE ORDER BY room_number;');
      console.log(`[Backend DEBUG] getAvailableRooms: 共有 ${allPotentiallyOpenRooms.rows.length} 个 is_closed = FALSE 的房间.`);
      for (const room of allPotentiallyOpenRooms.rows) {
        const conflictingOrders = await query( `
          SELECT o.order_id, o.room_number, o.status, o.check_in_date, o.check_out_date
          FROM orders o
          WHERE o.room_number = $1
            AND o.status IN ('pending', 'checked-in')
            AND o.check_in_date < $3::date
            AND o.check_out_date > $2::date;`,
          [room.room_number, queryStartDate, queryEndDate]
        );
        if (conflictingOrders.rows.length > 0) {
          console.log(`[Backend DEBUG] getAvailableRooms: 房间 ${room.room_number} (is_closed=FALSE) 因为以下冲突订单而不可用:`, conflictingOrders.rows.map(o => ({id: o.order_id, status: o.status, in: o.check_in_date, out: o.check_out_date })));
        } else {
           // 如果 typeCode 存在且不匹配，也记录一下
           if (typeCode && room.type_code !== typeCode) {
             console.log(`[Backend DEBUG] getAvailableRooms: 房间 ${room.room_number} (is_closed=FALSE, 无冲突订单) 因为房型 ${room.type_code} 不匹配 ${typeCode} 而不可用.`);
           } else {
             console.log(`[Backend DEBUG] getAvailableRooms: 房间 ${room.room_number} (is_closed=FALSE, 无冲突订单, 房型匹配或无房型筛选) 理论上应该可用，但未出现在结果中，请检查SQL逻辑或参数。`);
           }
        }
      }
    }
    */

    return availableRooms;
  } catch (error) {
    console.error('[Backend ERROR] getAvailableRooms: 查询可用房间时发生错误:', error);
    // 可以考虑抛出更具体的错误或错误代码
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
