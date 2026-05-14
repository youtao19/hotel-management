const roomManageRepository = require('./roomManage.repository');

const DISPLAY_STATUSES = ['available', 'occupied', 'reserved', 'cleaning', 'repair'];

function createRoomSummary(roomRows = [], summaryDate = null) {
  const summary = {
    date: summaryDate || null,
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    cleaning: 0,
    repair: 0
  };

  for (const row of roomRows) {
    const status = DISPLAY_STATUSES.includes(row?.display_status) ? row.display_status : 'available';
    summary.total += 1;
    summary[status] += 1;
  }

  return summary;
}

function normalizeRoomKeyword(keyword) {
  return String(keyword || '').trim().toLowerCase();
}

function matchesRoomKeyword(roomRow, normalizedKeyword) {
  if (!normalizedKeyword) return true;
  const haystack = [
    roomRow?.room_number,
    roomRow?.order_id,
    roomRow?.guest_name,
    roomRow?.phone,
    roomRow?.remarks
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedKeyword);
}

function createRoomError(message, code, statusCode = 400) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

/**
 * 给房态页读取房间列表。
 * display_status 由数据库查询统一计算，service 只处理页面筛选和摘要。
 */
async function listRooms(filters = null) {
  const normalizedFilters = (filters && typeof filters === 'object' && !Array.isArray(filters))
    ? filters
    : { date: filters || null };
  const queryDate = normalizedFilters?.date ? String(normalizedFilters.date).trim() : null;
  const typeCode = normalizedFilters?.typeCode ? String(normalizedFilters.typeCode).trim() : null;
  const status = normalizedFilters?.status ? String(normalizedFilters.status).trim() : null;
  const keyword = normalizeRoomKeyword(normalizedFilters?.keyword);

  const result = await roomManageRepository.listRoomsByDate(queryDate);
  const filteredRows = result.rows.filter((row) => {
    if (typeCode && row.type_code !== typeCode) return false;
    if (status && row.display_status !== status) return false;
    if (!matchesRoomKeyword(row, keyword)) return false;
    return true;
  });
  const summaryDate = filteredRows[0]?.query_date || result.rows[0]?.query_date || queryDate || null;

  return {
    rows: filteredRows,
    summary: createRoomSummary(filteredRows, summaryDate)
  };
}

async function listAvailableRooms(startDate, endDate, typeCode = null) {
  console.log('[Backend INFO] getAvailableRooms: 函数入口，原始参数:', { startDate, endDate, typeCode });
  const queryStartDate = startDate.split('T')[0];
  const queryEndDate = endDate.split('T')[0];
  console.log('[Backend INFO] getAvailableRooms: 处理后的查询日期:', { queryStartDate, queryEndDate });
  console.log('[Backend INFO] getAvailableRooms: 是否为休息房查询:', queryStartDate === queryEndDate);

  if (typeCode) {
    console.log('[Backend INFO] getAvailableRooms: 添加了房型筛选 typeCode:', typeCode);
  } else {
    console.log('[Backend INFO] getAvailableRooms: 未指定房型筛选 typeCode.');
  }

  const availableRooms = await roomManageRepository.listAvailableRooms(queryStartDate, queryEndDate, typeCode);
  console.log(`[Backend INFO] getAvailableRooms: 数据库查询完毕，找到 ${availableRooms.length} 个符合条件的房间.`);

  if (availableRooms.length > 0) {
    console.log('[Backend INFO] getAvailableRooms: 可用房间号列表:', availableRooms.map(room => room.room_number).join(', '));
  } else {
    console.log('[Backend INFO] getAvailableRooms: 没有找到符合条件的可用房间。');
  }

  return availableRooms;
}

async function getRoomStatusRange(roomNumber, startDate, endDate) {
  return roomManageRepository.listRoomStatusRange(roomNumber, startDate, endDate);
}

/**
 * 给日历房主视图生成 14 天房态矩阵。
 * 筛选后再计算 dailySummary，保证顶部余房数和可见房间一致。
 */
async function getCalendarBoard(filters = {}) {
  const startDate = String(filters?.startDate || '').trim();
  const days = Number(filters?.days || 14);
  const typeCode = filters?.typeCode ? String(filters.typeCode).trim() : null;
  const status = filters?.status ? String(filters.status).trim() : null;
  const keyword = normalizeRoomKeyword(filters?.keyword);

  const rows = await roomManageRepository.listCalendarBoardRows(startDate, days, typeCode);
  const roomMap = new Map();
  const dateMap = new Map();

  for (const row of rows) {
    if (!roomMap.has(row.room_number)) {
      roomMap.set(row.room_number, {
        room_number: row.room_number,
        type_code: row.type_code,
        type_name: row.type_name,
        room_status: row.room_status,
        is_closed: row.is_closed,
        price: row.price,
        calendar: []
      });
    }

    const roomEntry = roomMap.get(row.room_number);
    roomEntry.calendar.push({
      date: row.stay_date,
      display_status: row.display_status,
      price: row.price,
      order_id: row.order_id,
      order_status: row.order_status,
      guest_name: row.guest_name,
      phone: row.phone,
      remarks: row.remarks,
      check_in_date: row.check_in_date,
      check_out_date: row.check_out_date
    });

    if (!dateMap.has(row.stay_date)) {
      dateMap.set(row.stay_date, {
        date: row.stay_date,
        total: 0,
        available: 0,
        occupied: 0,
        reserved: 0,
        cleaning: 0,
        repair: 0,
        available_count: 0
      });
    }
  }

  const filteredRooms = Array.from(roomMap.values())
    .filter((room) => {
      const statusMatched = !status || room.calendar.some(cell => cell.display_status === status);
      if (!statusMatched) return false;

      if (!keyword) return true;
      return room.calendar.some(cell => matchesRoomKeyword({
        room_number: room.room_number,
        order_id: cell.order_id,
        guest_name: cell.guest_name,
        phone: cell.phone,
        remarks: cell.remarks
      }, keyword));
    })
    .sort((left, right) => {
      const groupCompare = String(left.type_name || left.type_code || '').localeCompare(
        String(right.type_name || right.type_code || ''),
        'zh-Hans-CN'
      );
      if (groupCompare !== 0) return groupCompare;
      return String(left.room_number).localeCompare(String(right.room_number), 'zh-Hans-CN');
    });

  const filteredRows = [];
  for (const room of filteredRooms) {
    for (const cell of room.calendar) {
      filteredRows.push({
        room_number: room.room_number,
        display_status: cell.display_status,
        stay_date: cell.date
      });
      const dateEntry = dateMap.get(cell.date);
      if (!dateEntry) continue;
      dateEntry.total += 1;
      dateEntry[cell.display_status] += 1;
      if (cell.display_status === 'available') {
        dateEntry.available_count += 1;
      }
    }
  }

  const dailySummary = Array.from(dateMap.values())
    .filter(item => item.total > 0)
    .sort((left, right) => String(left.date).localeCompare(String(right.date), 'zh-Hans-CN'));
  const summaryRows = filteredRows.filter(row => row.stay_date === startDate);

  return {
    query: {
      startDate,
      days,
      typeCode,
      status,
      keyword: String(filters?.keyword || '').trim()
    },
    summary: createRoomSummary(summaryRows, startDate),
    dailySummary,
    rooms: filteredRooms
  };
}

async function getRoomByNumber(roomNumber) {
  return roomManageRepository.findRoomByNumber(roomNumber);
}

/**
 * 修改房态时同步 is_closed。
 * 当前旧规则只有维修态关闭房间，其它状态重新开放。
 */
async function updateRoomStatus(roomNumber, status) {
  console.log(`更新房间(Number: ${roomNumber})状态为: ${status}`);
  const isClosed = status === 'repair';

  if (isClosed) {
    console.log(`设置房间 ${roomNumber} 为关闭状态(is_closed=true)`);
  } else {
    console.log(`设置房间 ${roomNumber} 为开放状态(is_closed=false)`);
  }

  console.log(`执行SQL: UPDATE rooms SET status = '${status}', is_closed = ${isClosed} WHERE room_number = '${roomNumber}'`);
  const updatedRoom = await roomManageRepository.updateRoomStatus(null, roomNumber, status, isClosed);

  if (updatedRoom) {
    console.log('更新成功，结果:', updatedRoom);
  } else {
    console.log(`未找到Number为 ${roomNumber} 的房间`);
  }
  return updatedRoom;
}

async function addRoom(roomData) {
  const { room_number, type_code, status, price } = roomData;
  const client = await roomManageRepository.getClient();

  try {
    await client.query('BEGIN');

    const exists = await roomManageRepository.checkRoomExists(client, room_number);
    if (exists) {
      throw createRoomError('房间号已存在', 'ROOM_EXISTS');
    }

    const roomType = await roomManageRepository.findRoomTypeBasePrice(client, type_code);
    if (!roomType) {
      throw createRoomError('房型不存在', 'ROOM_TYPE_NOT_FOUND');
    }

    const basePrice = Number(roomType.base_price);
    const finalPrice = typeof price === 'number' && Number.isFinite(price) && price > 0
      ? price
      : (Number.isFinite(basePrice) ? basePrice : 0);

    const roomIdColumnInfo = await roomManageRepository.getRoomIdColumnInfo(client);
    let roomId = null;

    if (roomIdColumnInfo) {
      const { column_default: columnDefault, is_nullable: isNullable } = roomIdColumnInfo;
      if (isNullable === 'NO' && columnDefault === null) {
        roomId = await roomManageRepository.getNextRoomId(client);
      }
    }

    const newRoom = await roomManageRepository.insertRoom(client, {
      roomId,
      room_number,
      type_code,
      status,
      price: finalPrice
    });

    await client.query('COMMIT');
    return newRoom;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('添加房间回滚失败:', rollbackErr);
    }
    console.error('添加房间失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function updateRoom(roomNumber, roomData) {
  const existingRoom = await roomManageRepository.findRoomByNumber(roomNumber);
  if (!existingRoom) {
    return null;
  }

  return roomManageRepository.updateRoom(roomNumber, roomData);
}

async function deleteRoom(roomNumber) {
  const existingRoom = await roomManageRepository.findRoomByNumber(roomNumber);
  if (!existingRoom) {
    return { deleted: false, reason: 'not_found' };
  }

  const activeOrders = await roomManageRepository.countActiveOrdersByRoom(roomNumber);
  if (activeOrders > 0) {
    return { deleted: false, reason: 'active_orders' };
  }

  await roomManageRepository.deleteRoom(roomNumber);
  console.log('成功删除房间:', existingRoom.room_number);
  return { deleted: true };
}

/**
 * 整单更换房间。
 * 沿用旧的全局事务调用方式，避免本轮重构改变事务边界。
 */
async function changeOrderRoom(orderNumber, oldRoomNumber, newRoomNumber) {
  console.log(`更换房间请求: 订单 ${orderNumber} 从房间 ${oldRoomNumber} 换到 ${newRoomNumber}`);

  if (!orderNumber || !oldRoomNumber || !newRoomNumber) {
    throw createRoomError('缺少必要参数', 'MISSING_PARAMS');
  }
  if (oldRoomNumber === newRoomNumber) {
    throw createRoomError('新房间与原房间相同，无需更换', 'SAME_ROOM');
  }

  const order = await roomManageRepository.findChangeableOrder(orderNumber);
  if (!order) {
    throw createRoomError('订单不存在或状态不允许更换房间（只有待入住和已入住订单可以更换房间）', 'ORDER_STATUS_INVALID');
  }

  const newRoom = await roomManageRepository.findRoomByNumber(newRoomNumber);
  if (!newRoom) {
    throw createRoomError('新房间不存在', 'NEW_ROOM_NOT_FOUND');
  }
  if (newRoom.is_closed) {
    throw createRoomError('新房间已关闭，无法使用', 'NEW_ROOM_CLOSED');
  }
  if (newRoom.status === 'repair') {
    throw createRoomError('新房间正在维修，无法使用', 'NEW_ROOM_REPAIR');
  }
  if (order.status === 'checked-in' && newRoom.status !== 'available') {
    throw createRoomError(`新房间当前状态为"${newRoom.status}"，已入住订单只能换到可用房间`, 'NEW_ROOM_NOT_AVAILABLE');
  }

  const conflicts = await roomManageRepository.countRoomConflicts(
    newRoomNumber,
    orderNumber,
    order.check_in_date,
    order.check_out_date
  );
  if (conflicts > 0) {
    throw createRoomError('新房间在指定日期期间已被预订', 'NEW_ROOM_CONFLICT');
  }

  await roomManageRepository.beginGlobalTransaction();
  try {
    const nightsRaw = await roomManageRepository.calculateNights(order.check_in_date, order.check_out_date);
    const nights = nightsRaw > 0 ? nightsRaw : 1;
    const newTotalPrice = Number(newRoom.price) * nights;

    console.log(`更换房间价格计算: 新房间单价 ${newRoom.price} × ${nights}晚 = ${newTotalPrice}`);
    const updatedOrder = await roomManageRepository.updateOrderRoom(
      orderNumber,
      newRoomNumber,
      newRoom.type_code,
      newTotalPrice
    );
    if (!updatedOrder) {
      throw createRoomError('更新订单失败', 'UPDATE_ORDER_FAILED', 500);
    }

    if (order.status === 'checked-in') {
      console.log('更新房间状态：已入住订单更换房间');
      await roomManageRepository.setRoomStatusOnly(oldRoomNumber, 'cleaning');
      await roomManageRepository.setRoomStatusOnly(newRoomNumber, 'occupied');
      console.log(`房间状态已更新: ${oldRoomNumber} -> 清洁中, ${newRoomNumber} -> 占用`);
    }

    await roomManageRepository.commitGlobalTransaction();
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
    await roomManageRepository.rollbackGlobalTransaction();
    throw error;
  }
}

module.exports = {
  addRoom,
  changeOrderRoom,
  deleteRoom,
  getCalendarBoard,
  getRoomByNumber,
  getRoomStatusRange,
  listAvailableRooms,
  listRooms,
  updateRoom,
  updateRoomStatus
};
