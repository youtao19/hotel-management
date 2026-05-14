const roomManageRepository = require('./roomManage.repository');

function createRoomError(message, code, statusCode = 400) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
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

async function getRoomByNumber(roomNumber) {
  return roomManageRepository.findRoomByNumber(roomNumber);
}

async function listRoomTypes() {
  return roomManageRepository.listRoomTypes();
}

async function getRoomTypeByCode(typeCode) {
  return roomManageRepository.findRoomTypeByCode(typeCode);
}

async function addRoomType(roomTypeData) {
  const existingRoomType = await roomManageRepository.findRoomTypeByCode(roomTypeData.type_code);
  if (existingRoomType) {
    throw createRoomError('房型代码已存在', 'ROOM_TYPE_EXISTS');
  }

  return roomManageRepository.insertRoomType(roomTypeData);
}

/**
 * 修改房型基础价格时同步房间价格。
 * 房型配置页把房型价格视为该房型下房间的默认价格，沿用旧事务边界。
 */
async function updateRoomType(typeCode, roomTypeData) {
  const client = await roomManageRepository.getClient();

  try {
    await client.query('BEGIN');

    const existingRoomType = await roomManageRepository.findRoomTypeByCode(typeCode, client);
    if (!existingRoomType) {
      await client.query('ROLLBACK');
      return { updatedRoomType: null, syncedRooms: 0 };
    }

    const updatedRoomType = await roomManageRepository.updateRoomType(client, typeCode, roomTypeData);
    const syncRoomsResult = await roomManageRepository.syncRoomPriceByType(
      client,
      typeCode,
      roomTypeData.base_price
    );

    await client.query('COMMIT');

    return {
      updatedRoomType,
      syncedRooms: syncRoomsResult.rowCount
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('更新房型回滚失败:', rollbackErr);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function deleteRoomType(typeCode) {
  const orderCount = await roomManageRepository.countOrdersByRoomType(typeCode);
  if (orderCount > 0) {
    return { deleted: false, reason: 'orders' };
  }

  const roomCount = await roomManageRepository.countRoomsByType(typeCode);
  if (roomCount > 0) {
    return { deleted: false, reason: 'rooms' };
  }

  const existingRoomType = await roomManageRepository.findRoomTypeByCode(typeCode);
  if (!existingRoomType) {
    return { deleted: false, reason: 'not_found' };
  }

  await roomManageRepository.deleteRoomType(typeCode);
  return { deleted: true };
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

module.exports = {
  addRoom,
  addRoomType,
  deleteRoom,
  deleteRoomType,
  getRoomTypeByCode,
  getRoomByNumber,
  listAvailableRooms,
  listRoomTypes,
  updateRoom,
  updateRoomType
};
