"use strict";
const { query, getClient } = require('../database/postgreDB/pg');
/**
 * 获取所有房间
 * @param {string} [queryDate] - 查询日期 YYYY-MM-DD，如果不提供则查询当前活跃订单
 * @returns {Promise<Array>} 所有房间列表
 */
async function getAllRooms(queryDate = null) {
  try {
    // 说明：
    // - 房态最终显示(display_status)由 SQL 直接计算，前端仅渲染该字段
    // - 日期字段不使用 new Date()/toISOString() 做业务计算，统一以 YYYY-MM-DD 字符串传递给数据库
    const sql = `
      WITH selected_date AS (
        SELECT COALESCE($1::date, CURRENT_DATE) AS stay_date
      )
      SELECT
        r.room_id,
        r.room_number,
        r.type_code,
        r.status,
        r.price,
        r.is_closed,
        o.guest_name,
        o.check_out_date,
        o.order_status,
        o.order_id,
        o.check_in_date,
        o.stay_type,
        CASE
          -- 维修状态优先级最高（房间不可用）
          WHEN r.is_closed = TRUE OR r.status = 'repair' THEN 'repair'
          -- 订单状态优先：前台优先看到预订中或入住中的订单
          WHEN o.order_status IN ('checked-in', 'occupied') THEN 'occupied'
          WHEN o.order_status IN ('pending', 'reserved') THEN 'reserved'
          -- 清扫状态次于订单状态（无订单时才显示清扫中）
          WHEN r.status = 'cleaning' THEN 'cleaning'
          ELSE 'available'
        END AS display_status
      FROM rooms r
      CROSS JOIN selected_date sd
      LEFT JOIN LATERAL (
        SELECT
          o.guest_name,
          o.check_out_date,
          o.status AS order_status,
          o.order_id,
          o.check_in_date,
          o.stay_type
        FROM orders o
        WHERE o.room_number = r.room_number
          AND o.stay_date = sd.stay_date
          AND o.status IN ('pending', 'reserved', 'checked-in', 'occupied')
        ORDER BY
          CASE
            WHEN o.status IN ('checked-in', 'occupied') THEN 2
            WHEN o.status IN ('pending', 'reserved') THEN 1
            ELSE 0
          END DESC,
          o.create_time DESC
        LIMIT 1
      ) o ON TRUE
      ORDER BY r.room_number
    `;

    const result = await query(sql, [queryDate]);
    return result.rows;
  } catch (error) {
    console.error('获取所有房间失败:', error);
    throw error;
  }
}

/**
 * 获取指定房间在日期区间内的每日房态（用于日历按天渲染）
 * @param {string} roomNumber - 房间号
 * @param {string} startDate - 开始日期 YYYY-MM-DD
 * @param {string} endDate - 结束日期 YYYY-MM-DD
 * @returns {Promise<Array>} 每日房态列表
 */
async function getRoomStatusRange(roomNumber, startDate, endDate) {
  try {
    const sql = `
      WITH date_series AS (
        SELECT generate_series($2::date, $3::date, interval '1 day')::date AS stay_date
      ),
      room_row AS (
        SELECT room_number, type_code, status, price, is_closed
        FROM rooms
        WHERE room_number = $1
        LIMIT 1
      ),
      order_candidates AS (
        SELECT
          o.stay_date,
          o.order_id,
          o.guest_name,
          o.check_in_date,
          o.check_out_date,
          o.status AS order_status,
          o.create_time,
          CASE
            WHEN o.status IN ('checked-in', 'occupied') THEN 2
            WHEN o.status IN ('pending', 'reserved') THEN 1
            ELSE 0
          END AS status_rank
        FROM orders o
        WHERE o.room_number = $1
          AND o.stay_date >= $2::date
          AND o.stay_date <= $3::date
          AND o.status IN ('pending', 'reserved', 'checked-in', 'occupied')
      ),
      best_order AS (
        SELECT DISTINCT ON (stay_date)
          stay_date,
          order_id,
          guest_name,
          check_in_date,
          check_out_date,
          order_status
        FROM order_candidates
        ORDER BY stay_date, status_rank DESC, create_time DESC
      )
      SELECT
        ds.stay_date::text AS stay_date,
        r.room_number,
        r.type_code,
        r.price,
        r.status AS room_status,
        r.is_closed,
        bo.order_id,
        bo.guest_name,
        bo.check_in_date,
        bo.check_out_date,
        bo.order_status,
        CASE
          -- 维修状态优先级最高（房间不可用）
          WHEN r.is_closed = TRUE OR r.status = 'repair' THEN 'repair'
          -- 订单状态优先：前台优先看到预订中或入住中的订单
          WHEN bo.order_status IN ('checked-in', 'occupied') THEN 'occupied'
          WHEN bo.order_status IN ('pending', 'reserved') THEN 'reserved'
          -- 清扫状态次于订单状态（无订单时才显示清扫中）
          WHEN r.status = 'cleaning' THEN 'cleaning'
          ELSE 'available'
        END AS display_status
      FROM date_series ds
      CROSS JOIN room_row r
      LEFT JOIN best_order bo ON bo.stay_date = ds.stay_date
      ORDER BY ds.stay_date
    `;

    const result = await query(sql, [roomNumber, startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error('获取房间日期范围房态失败:', error);
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
 * @param {number} number - 房间ID
 * @param {string} status - 新状态
 * @returns {Promise<Object|null>} 更新后的房间对象或null
 */
async function updateRoomStatus(number, status) {
  try {
    console.log(`更新房间(Number: ${number})状态为: ${status}`);

    // 直接使用传入的状态值，不做转换
    let isClosed = false;

    // 根据状态自动设置房间的is_closed字段
    if (status === 'repair') {
      console.log(`设置房间 ${number} 为关闭状态(is_closed=true)`);
      isClosed = true; // 维修中或清洁中的房间设为关闭状态
    } else {
      console.log(`设置房间 ${number} 为开放状态(is_closed=false)`);
    }

    // 执行房间状态更新，同时更新is_closed字段
    console.log(`执行SQL: UPDATE rooms SET status = '${status}', is_closed = ${isClosed} WHERE room_number = '${number}'`);
    const { rows } = await query(
      'UPDATE rooms SET status = $1, is_closed = $2 WHERE room_number = $3 RETURNING *',
      [status, isClosed, number]
    );

    if (rows.length > 0) {
      console.log(`更新成功，结果:`, rows[0]);
    } else {
      console.log(`未找到Number为 ${number} 的房间`);
    }
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error(`更新房间(Number: ${number})状态失败:`, error);
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

    // 3. 验证新房间与原订单房型是否相同
    if (newRoom.type_code !== order.room_type) {
  const err = new Error(`新房间房型(${newRoom.type_code})与订单房型(${order.room_type})不一致，无法更换`);
  err.code = 'ROOM_TYPE_MISMATCH';
  throw err;
    }

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
  getAllRooms,
  getRoomStatusRange,
  getRoomByNumber,
  updateRoomStatus,
  addRoom,
  getAllRoomTypes,
  getAvailableRooms,
  changeOrderRoom
};
