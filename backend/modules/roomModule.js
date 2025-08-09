"use strict";
const { query } = require('../database/postgreDB/pg');
/**
 * 获取所有房间
 * @param {string} [queryDate] - 查询日期 YYYY-MM-DD，如果不提供则查询当前活跃订单
 * @returns {Promise<Array>} 所有房间列表
 */
async function getAllRooms(queryDate = null) {
  try {
    // 使用两次查询，先获取全部房间，然后获取已有订单的房间，最后合并数据
    // 这样可以确保不会漏掉任何房间

    // 1. 获取所有房间的基本信息
    console.log('开始获取房间基本信息...');
    const roomsResult = await query('SELECT * FROM rooms ORDER BY room_number');
    console.log(`查询到 ${roomsResult.rows.length} 个房间`);

    const allRooms = roomsResult.rows;

    // 2. 获取房间与订单的关联信息
    let ordersSQL;
    let queryParams = [];

    if (queryDate) {
      // 如果指定了查询日期，获取该日期的房间状态
      console.log(`开始获取 ${queryDate} 日期的房间关联订单信息...`);
      ordersSQL = `
        SELECT DISTINCT ON (o.room_number)
          o.room_number,
          o.guest_name,
          o.check_out_date,
          o.status as order_status,
          o.order_id,
          o.check_in_date
        FROM orders o
        WHERE o.check_in_date <= $1::date
          AND o.check_out_date > $1::date
          AND o.status IN ('pending', 'checked-in')
        ORDER BY o.room_number, o.create_time DESC
      `;
      queryParams = [queryDate];
    } else {
      // 如果没有指定日期，获取当前活跃订单
      console.log('开始获取房间关联的当前活跃订单信息...');
      ordersSQL = `
        SELECT DISTINCT ON (o.room_number)
          o.room_number,
          o.guest_name,
          o.check_out_date,
          o.status as order_status,
          o.order_id,
          o.check_in_date
        FROM orders o
        WHERE o.status IN ('pending', 'checked-in')
        ORDER BY o.room_number, o.create_time DESC
      `;
    }

    const ordersResult = await query(ordersSQL, queryParams);
    console.log(`查询到 ${ordersResult.rows.length} 个相关订单`);

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
          order_id: order.order_id,
          check_in_date: order.check_in_date
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
          guest_name: room.guest_name,
          query_date: queryDate || 'current'
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
    if (status === 'repair') {
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

    // 判断是否为休息房查询（同一天入住和退房）
    const isRestRoomQuery = queryStartDate === queryEndDate;
    console.log('[Backend INFO] getAvailableRooms: 是否为休息房查询:', isRestRoomQuery);

    let sqlQuery;
    if (isRestRoomQuery) {
      // 休息房查询：检查当天是否有冲突
      sqlQuery = `
        SELECT r.room_id, r.room_number, r.type_code, r.status, r.price, r.is_closed
        FROM rooms r
        WHERE r.is_closed = FALSE
          AND r.status != 'repair'
          AND NOT EXISTS (
            SELECT 1
            FROM orders o
            WHERE o.room_number = r.room_number
              AND o.status IN ('checked-in', 'pending')
              AND (
                (o.check_in_date = $1::date) OR
                (o.check_out_date = $1::date) OR
                (o.check_in_date < $1::date AND o.check_out_date > $1::date)
              )
          )
      `;
    } else {
      // 普通订单查询：标准的日期区间冲突检查
      sqlQuery = `
        SELECT r.room_id, r.room_number, r.type_code, r.status, r.price, r.is_closed
        FROM rooms r
        WHERE r.is_closed = FALSE
          AND r.status != 'repair'
          AND NOT EXISTS (
            SELECT 1
            FROM orders o
            WHERE o.room_number = r.room_number
              AND o.status IN ('checked-in', 'pending')
              AND o.check_in_date < $2::date
              AND o.check_out_date > $1::date
          )
      `;
    }

    const queryParams = isRestRoomQuery ? [queryStartDate] : [queryStartDate, queryEndDate];

    // 如果指定了房型，添加房型筛选条件
    if (typeCode) {
      const paramIndex = isRestRoomQuery ? 2 : 3;
      sqlQuery += ` AND r.type_code = $${paramIndex}::varchar`;
      queryParams.push(typeCode);
      console.log('[Backend INFO] getAvailableRooms: 添加了房型筛选 typeCode:', typeCode);
    } else {
      console.log('[Backend INFO] getAvailableRooms: 未指定房型筛选 typeCode.');
    }

    // 添加排序
    sqlQuery += ' ORDER BY r.room_number';

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

    return availableRooms;
  } catch (error) {
    console.error('[Backend ERROR] getAvailableRooms: 查询可用房间时发生错误:', error);
    // 可以考虑抛出更具体的错误或错误代码
    throw error;
  }
}

/**
 * 更换房间（待入住和已入住订单均可）
 * @param {string} orderNumber - 订单号
 * @param {string} oldRoomNumber - 原房间号
 * @param {string} newRoomNumber - 新房间号
 * @returns {Promise<Object>} 更新结果
 */
async function changeOrderRoom(orderNumber, oldRoomNumber, newRoomNumber) {
  console.log(`更换房间请求: 订单 ${orderNumber} 从房间 ${oldRoomNumber} 换到 ${newRoomNumber}`);

  try {
        // 1. 验证订单状态（待入住和已入住的订单可以更换房间）
    const orderCheckResult = await query(
      'SELECT * FROM orders WHERE order_id = $1 AND status IN ($2, $3)',
      [orderNumber, 'pending', 'checked-in']
    );

    if (orderCheckResult.rows.length === 0) {
      throw new Error('订单不存在或状态不允许更换房间（只有待入住和已入住订单可以更换房间）');
    }

    const order = orderCheckResult.rows[0];

    // 2. 验证新房间是否存在且可用
    const newRoomResult = await query(
      'SELECT * FROM rooms WHERE room_number = $1',
      [newRoomNumber]
    );

    if (newRoomResult.rows.length === 0) {
      throw new Error('新房间不存在');
    }

    const newRoom = newRoomResult.rows[0];

    if (newRoom.is_closed) {
      throw new Error('新房间已关闭，无法使用');
    }

    if (newRoom.status === 'repair') {
      throw new Error('新房间正在维修，无法使用');
    }

    // 对于已入住的订单，新房间必须是可用状态
    if (order.status === 'checked-in' && newRoom.status !== 'available') {
      throw new Error(`新房间当前状态为"${newRoom.status}"，已入住订单只能换到可用房间`);
    }

        // 3. 检查新房间在订单日期期间是否有冲突
    const conflictCheckResult = await query(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE room_number = $1
        AND status IN ('pending', 'checked-in')
        AND order_id != $2
        AND check_in_date < $4::date
        AND check_out_date > $3::date
    `, [newRoomNumber, orderNumber, order.check_in_date, order.check_out_date]);

    if (parseInt(conflictCheckResult.rows[0].count) > 0) {
      throw new Error('新房间在指定日期期间已被预订');
    }

    // 4. 开始事务更新
    await query('BEGIN');

    try {
            // 更新订单的房间信息
      const updateOrderResult = await query(`
        UPDATE orders
        SET room_number = $1, room_type = $2, room_price = $3
        WHERE order_id = $4
        RETURNING *
      `, [newRoomNumber, newRoom.type_code, newRoom.price, orderNumber]);

      if (updateOrderResult.rows.length === 0) {
        throw new Error('更新订单失败');
      }

            const updatedOrder = updateOrderResult.rows[0];

      // 如果是已入住订单，需要更新房间状态
      if (order.status === 'checked-in') {
        console.log('更新房间状态：已入住订单更换房间');

        // 将原房间状态改为清洁中
        await query(
          'UPDATE rooms SET status = $1 WHERE room_number = $2',
          ['cleaning', oldRoomNumber]
        );

        // 将新房间状态改为占用
        await query(
          'UPDATE rooms SET status = $1 WHERE room_number = $2',
          ['occupied', newRoomNumber]
        );

        console.log(`房间状态已更新: ${oldRoomNumber} -> 清洁中, ${newRoomNumber} -> 占用`);
      }

      await query('COMMIT');

      console.log(`房间更换成功: 订单 ${orderNumber} 已从 ${oldRoomNumber} 换到 ${newRoomNumber}`);

      return {
        success: true,
        message: '房间更换成功',
        updatedOrder,
        newRoom: {
          room_number: newRoom.room_number,
          type_code: newRoom.type_code,
          price: newRoom.price
        }
      };

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('更换房间失败:', error);
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
  getAvailableRooms,
  changeOrderRoom
};
