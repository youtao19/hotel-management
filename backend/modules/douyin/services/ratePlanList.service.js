const {
  listLocalRatePlansWithDouyinStatus,
} = require('../repositories/localRatePlan.repository')

const LOCAL_DATA_STATUS = Object.freeze({
  OK: 'OK',
  ROOM_MISSING: 'ROOM_MISSING',
  ROOM_TYPE_MISSING: 'ROOM_TYPE_MISSING',
})

function resolveLocalDataStatus(row = {}) {
  if (!row.local_room_exists) {
    return LOCAL_DATA_STATUS.ROOM_MISSING
  }

  if (!row.local_room_type_exists) {
    return LOCAL_DATA_STATUS.ROOM_TYPE_MISSING
  }

  return LOCAL_DATA_STATUS.OK
}

function mapRatePlanListItem(row = {}) {
  const syncStatus = row.sync_status === null || row.sync_status === undefined
    ? null
    : Number(row.sync_status)

  return {
    localRatePlanId: row.id,
    roomId: row.room_id,
    ratePlanName: row.name,
    basePrice: row.base_price,
    ratePlanStatus: row.status,
    roomNumber: row.room_number || null,
    localRoomType: row.type_code || null,
    localRoomTypeName: row.type_name || null,
    localRoomExists: Boolean(row.local_room_exists),
    localRoomTypeExists: Boolean(row.local_room_type_exists),
    localDataStatus: resolveLocalDataStatus(row),
    roomStatus: row.room_status || null,
    roomIsClosed: row.room_is_closed ?? null,
    roomTypeIsClosed: row.room_type_is_closed ?? null,
    douyinRoomId: row.douyin_room_id || null,
    douyinRoomName: row.douyin_room_name || row.physical_room_name || null,
    douyinPhysicalRoomId: row.physical_room_id || null,
    douyinPhysicalRoomStatus: row.physical_status ?? null,
    douyinPhysicalRoomAuditMessage: row.audit_message || null,
    douyinAccountId: row.account_id || null,
    douyinRatePlanId: row.douyin_rate_plan_id || null,
    syncStatus,
    syncUpdatedAt: row.sync_updated_at || null,
    isDouyinRoomBound: Boolean(row.douyin_room_id),
    isSynced: syncStatus === 1,
  }
}

async function listDouyinRatePlansService() {
  const rows = await listLocalRatePlansWithDouyinStatus()
  return rows.map(mapRatePlanListItem)
}

module.exports = {
  LOCAL_DATA_STATUS,
  listDouyinRatePlansService,
  mapRatePlanListItem,
  resolveLocalDataStatus,
}
