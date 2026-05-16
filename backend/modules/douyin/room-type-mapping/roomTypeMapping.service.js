const roomStaticInfoService = require('../physical-room/physicalRoom.service');
const repository = require('./roomTypeMapping.repository');

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getMatchStatus(row) {
  if (!row.douyin_room_id) {
    return 'UNMATCHED';
  }

  if (!row.cached_room_id) {
    return 'MATCHED_BUT_ROOM_CACHE_MISSING';
  }

  if (Number(row.douyin_room_status) === 0 || row.douyin_room_active === 'false') {
    return 'DOUYIN_ROOM_INACTIVE';
  }

  return 'MATCHED';
}

function toMappingItem(row) {
  const matchStatus = getMatchStatus(row);

  return {
    localRoomType: row.type_code,
    localRoomTypeName: row.type_name,
    localBasePrice: Number(row.base_price || 0),
    douyinRoomId: row.douyin_room_id || null,
    douyinRoomName: row.douyin_room_name || row.cached_room_name || null,
    cachedRoomName: row.cached_room_name || null,
    douyinRoomStatus: row.douyin_room_status,
    douyinRoomActive: row.douyin_room_active,
    matchStatus,
    isMatched: matchStatus === 'MATCHED',
    updatedAt: row.mapping_updated_at
  };
}

function toDouyinRoomItem(row) {
  return {
    roomId: row.room_id,
    roomName: row.room_name,
    status: row.status,
    active: row.active,
    accountId: row.account_id,
    hotelId: row.hotel_id,
    boundLocalRoomType: row.bound_local_room_type || null,
    boundLocalRoomTypeName: row.bound_local_room_type_name || null,
    updatedAt: row.updated_at
  };
}

async function getMappingPageData() {
  const [mappingRows, roomRows] = await Promise.all([
    repository.listLocalRoomTypesWithMappings(),
    repository.listDouyinRoomsWithBindings()
  ]);

  const items = mappingRows.map(toMappingItem);
  const matchedCount = items.filter((item) => item.matchStatus === 'MATCHED').length;

  return {
    summary: {
      localRoomTypeCount: items.length,
      matchedCount,
      unmatchedCount: items.length - matchedCount,
      douyinRoomCount: roomRows.length
    },
    items,
    douyinRooms: roomRows.map(toDouyinRoomItem)
  };
}

async function ensureMappingsCanBeSaved(client, mappings) {
  const localTypes = mappings.map((item) => item.localRoomType);
  const douyinRoomIds = mappings.map((item) => item.douyinRoomId);

  if (new Set(localTypes).size !== localTypes.length) {
    throw createServiceError('同一个请求内不能重复绑定本地房型');
  }

  if (new Set(douyinRoomIds).size !== douyinRoomIds.length) {
    throw createServiceError('同一个请求内不能重复绑定抖音房型');
  }

  const existingLocalTypes = new Set(await repository.listExistingLocalRoomTypes(localTypes, client));
  const missingLocalType = localTypes.find((typeCode) => !existingLocalTypes.has(typeCode));
  if (missingLocalType) {
    throw createServiceError(`本地房型不存在：${missingLocalType}`);
  }

  const existingRoomIds = new Set(await repository.listExistingDouyinRoomIds(douyinRoomIds, client));
  const missingRoomId = douyinRoomIds.find((roomId) => !existingRoomIds.has(roomId));
  if (missingRoomId) {
    throw createServiceError(`抖音物理房型缓存不存在，请先刷新抖音房型：${missingRoomId}`);
  }

  const conflictRows = await repository.listMappingsByDouyinRoomIds(douyinRoomIds, client);
  const localTypeSet = new Set(localTypes);
  const conflict = conflictRows.find((row) => !localTypeSet.has(row.local_room_type));
  if (conflict) {
    throw createServiceError(`抖音房型 ${conflict.douyin_room_id} 已绑定本地房型 ${conflict.local_room_type}`);
  }
}

async function refreshRooms(options) {
  const refreshResult = await roomStaticInfoService.refreshPhysicalRoomsFromDouyin(options);
  const pageData = await getMappingPageData();

  return {
    refreshResult,
    data: {
      refresh: refreshResult,
      ...pageData
    }
  };
}

/**
 * 保存本地房型和抖音物理房型的一对一关系。
 * 删除旧绑定和写入新绑定必须共用事务，避免运营保存一半后出现重复或空绑定。
 */
async function saveMappings(mappings) {
  const client = await repository.getClient();

  try {
    await client.query('BEGIN');

    await ensureMappingsCanBeSaved(client, mappings);

    const localTypes = mappings.map((item) => item.localRoomType);
    await repository.deleteMappingsByLocalRoomTypes(localTypes, client);

    for (const mapping of mappings) {
      const room = await repository.findDouyinRoomById(mapping.douyinRoomId, client);
      const douyinRoomName = room?.room_name || mapping.douyinRoomId;
      await repository.insertMapping(mapping, douyinRoomName, client);
    }

    await client.query('COMMIT');

    return getMappingPageData();
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteMapping(localRoomType) {
  const deletedMapping = await repository.deleteMappingByLocalRoomType(localRoomType);
  if (!deletedMapping) {
    return null;
  }

  return getMappingPageData();
}

module.exports = {
  deleteMapping,
  getMappingPageData,
  refreshRooms,
  saveMappings
};
