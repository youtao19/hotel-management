"use strict";
const { query, getClient } = require('../database/postgreDB/pg');

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
 * 添加新房间
 * @param {Object} roomData - 房间数据对象
 * @returns {Promise<Object>} 新添加的房间对象
 */
async function addRoom(roomData) {
  const { room_number, type_code, status, price } = roomData;

  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');

    // 检查房间号是否已存在
    const checkResult = await client.query('SELECT 1 FROM rooms WHERE room_number = $1', [room_number]);
    if (checkResult.rows.length > 0) {
      const err = new Error('房间号已存在');
      err.code = 'ROOM_EXISTS';
      throw err;
    }

    // 验证房型是否存在，并获取默认价格
    const roomTypeResult = await client.query('SELECT base_price FROM room_types WHERE type_code = $1', [type_code]);
    if (roomTypeResult.rows.length === 0) {
      const err = new Error('房型不存在');
      err.code = 'ROOM_TYPE_NOT_FOUND';
      throw err;
    }

    const basePriceRaw = roomTypeResult.rows[0].base_price;
    const basePrice = Number(basePriceRaw);
    const finalPrice = typeof price === 'number' && Number.isFinite(price) && price > 0
      ? price
      : (Number.isFinite(basePrice) ? basePrice : 0);

    // 检查是否存在 room_id 列且需要手动赋值
    const roomIdColumnInfo = await client.query(
      `
        SELECT column_default, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rooms'
          AND column_name = 'room_id'
      `
    );

    let insertQueryText = 'INSERT INTO rooms (room_number, type_code, status, price) VALUES ($1, $2, $3, $4) RETURNING *';
    let insertParams = [room_number, type_code, status, finalPrice];

    if (roomIdColumnInfo.rows.length > 0) {
      const { column_default: columnDefault, is_nullable: isNullable } = roomIdColumnInfo.rows[0];
      const needsExplicitRoomId = isNullable === 'NO' && columnDefault === null;

      if (needsExplicitRoomId) {
        // 优先尝试使用序列
        const seqResult = await client.query('SELECT pg_get_serial_sequence($1, $2) AS seq_name', ['rooms', 'room_id']);
        let nextRoomId;
        const seqRow = seqResult.rows && seqResult.rows[0];

        if (seqRow && seqRow.seq_name) {
          const nextValResult = await client.query('SELECT nextval($1) AS next_id', [seqRow.seq_name]);
          nextRoomId = Number(nextValResult.rows[0].next_id);
        } else {
          const nextIdResult = await client.query('SELECT COALESCE(MAX(room_id), 0) + 1 AS next_id FROM rooms');
          nextRoomId = Number(nextIdResult.rows[0].next_id || 1);
        }

        insertQueryText = 'INSERT INTO rooms (room_id, room_number, type_code, status, price) VALUES ($1, $2, $3, $4, $5) RETURNING *';
        insertParams = [nextRoomId, room_number, type_code, status, finalPrice];
      }
    }

    // 插入新房间
    const { rows } = await client.query(insertQueryText, insertParams);

    await client.query('COMMIT');

    return rows[0];
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('添加房间回滚失败:', rollbackErr);
      }
    }
    console.error('添加房间失败:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
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

    let sqlQuery = `
      SELECT r.room_number, r.type_code, r.status, r.price, r.is_closed
      FROM rooms r
      WHERE r.is_closed = FALSE
        AND r.status != 'repair'
        AND NOT EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.room_number = r.room_number
            AND o.status NOT IN ('cancelled', 'checked-out')
            AND o.stay_date >= $1::date
            AND o.stay_date < (
              CASE
                WHEN $1::date = $2::date THEN ($1::date + 1)  -- 休息房：同日进出按 1 天占用
                ELSE $2::date                                 -- 普通订单：按 [start, end) 区间
              END
            )
        )
    `;

    const queryParams = [queryStartDate, queryEndDate];

    // 如果指定了房型，添加房型筛选条件
    if (typeCode) {
      const paramIndex = 3;
      sqlQuery += ` AND r.type_code = $${paramIndex}::varchar`;
      queryParams.push(typeCode);
      console.log('[Backend INFO] getAvailableRooms: 添加了房型筛选 typeCode:', typeCode);
    } else {
      console.log('[Backend INFO] getAvailableRooms: 未指定房型筛选 typeCode.');
    }

    // 添加排序
    sqlQuery += 'ORDER BY r.room_number';


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
        // 基础参数校验
    if (!orderNumber || !oldRoomNumber || !newRoomNumber) {
      const err = new Error('缺少必要参数');
      err.code = 'MISSING_PARAMS';
      throw err;
    }
    if (oldRoomNumber === newRoomNumber) {
      const err = new Error('新房间与原房间相同，无需更换');
      err.code = 'SAME_ROOM';
      throw err;
    }
        // 1. 验证订单状态（待入住和已入住的订单可以更换房间）
    const orderCheckResult = await query(
      'SELECT * FROM orders WHERE order_id = $1 AND status IN ($2, $3)',
      [orderNumber, 'pending', 'checked-in']
    );

    if (orderCheckResult.rows.length === 0) {
      const err = new Error('订单不存在或状态不允许更换房间（只有待入住和已入住订单可以更换房间）');
      err.code = 'ORDER_STATUS_INVALID';
      throw err;
    }

    const order = orderCheckResult.rows[0];

    // 2. 验证新房间是否存在且可用
    const newRoomResult = await query(
      'SELECT * FROM rooms WHERE room_number = $1',
      [newRoomNumber]
    );

    if (newRoomResult.rows.length === 0) {
  const err = new Error('新房间不存在');
  err.code = 'NEW_ROOM_NOT_FOUND';
  throw err;
    }

    const newRoom = newRoomResult.rows[0];

    if (newRoom.is_closed) {
  const err = new Error('新房间已关闭，无法使用');
  err.code = 'NEW_ROOM_CLOSED';
  throw err;
    }

    if (newRoom.status === 'repair') {
  const err = new Error('新房间正在维修，无法使用');
  err.code = 'NEW_ROOM_REPAIR';
  throw err;
    }

    // 3. 允许跨房型更换，继续校验新房间的可用状态
    // 对于已入住的订单，新房间必须是可用状态
    if (order.status === 'checked-in' && newRoom.status !== 'available') {
  const err = new Error(`新房间当前状态为"${newRoom.status}"，已入住订单只能换到可用房间`);
  err.code = 'NEW_ROOM_NOT_AVAILABLE';
  throw err;
    }

        // 4. 检查新房间在订单日期期间是否有冲突
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
  const err = new Error('新房间在指定日期期间已被预订');
  err.code = 'NEW_ROOM_CONFLICT';
  throw err;
    }

    // 5. 开始事务更新
    await query('BEGIN');

    try {
      // 更新订单的房间信息
      // 计算新的总价格（根据住宿天数）
      const { rows: nightsRows } = await query(
        `SELECT ($2::date - $1::date) AS nights`,
        [order.check_in_date, order.check_out_date]
      );
      const nightsRaw = Number(nightsRows?.[0]?.nights ?? 0);
      const nights = nightsRaw > 0 ? nightsRaw : 1; // 休息房等同日进出按 1 晚

      // 计算新的总价格
      const newTotalPrice = Number(newRoom.price) * nights;

      console.log(`更换房间价格计算: 新房间单价 ${newRoom.price} × ${nights}晚 = ${newTotalPrice}`);

      const updateOrderResult = await query(`
        UPDATE orders
        SET room_number = $1, room_type = $2, total_price = $3
        WHERE order_id = $4
        RETURNING *
      `, [newRoomNumber, newRoom.type_code, newTotalPrice, orderNumber]);

      if (updateOrderResult.rows.length === 0) {
        const err = new Error('更新订单失败');
        err.code = 'UPDATE_ORDER_FAILED';
        throw err;
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
  getRoomByNumber,
  addRoom,
  getAllRoomTypes,
  getAvailableRooms,
  changeOrderRoom
};
