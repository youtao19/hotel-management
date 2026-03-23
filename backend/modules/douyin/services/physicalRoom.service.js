const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const { upsertPhysicalRoom } = require('../repositories/physicalRoom.repository')

async function pullDouyinPhysicalRooms({ accountId, page = 1, size = 50 }) {
  if (!accountId) {
    throw new Error('accountId is required')
  }

  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/physical_room/search/',
    withAccountId: false,
    data: {
      account_id: accountId,
      page_no: page,
      page_size: size,
    },
  })

  return result
}

async function syncDouyinPhysicalRooms({ accountId, page = 1, size = 50 }) {
  const result = await pullDouyinPhysicalRooms({ accountId, page, size })

  const errorCode = result?.data?.error_code ?? result?.extra?.error_code ?? null
  if (errorCode && errorCode !== 0) {
    return {
      success: false,
      result,
      savedCount: 0,
    }
  }

  const roomList =
    result?.data?.room_list ||
    result?.data?.data?.room_list ||
    []

  const savedRooms = []

  for (const item of roomList) {
    const saved = await upsertPhysicalRoom({
      accountId,
      roomId: item.room_id,
      roomName: item.cn_name,
      status: item.status,
      auditMessage: item.audit_message || null,
      ratePlanList: item.rate_plan_list || [],
      rawPayload: item,
    })
    savedRooms.push(saved)
  }

  return {
    success: true,
    savedCount: savedRooms.length,
    rooms: savedRooms,
    raw: result,
  }
}

async function queryDouyinPhysicalRoomDetail({
  accountId,
  roomIds,
  needRatePlan = false,
}) {
  if (!accountId) {
    throw new Error('accountId is required')
  }

  if (!Array.isArray(roomIds) || roomIds.length === 0) {
    throw new Error('roomIds is required')
  }

  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/physical_room/query/',
    withAccountId: false,
    data: {
      account_id: accountId,
      room_ids: roomIds,
      need_rate_plan: needRatePlan,
    },
  })

  return result
}

module.exports = {
  pullDouyinPhysicalRooms,
  syncDouyinPhysicalRooms,
  queryDouyinPhysicalRoomDetail,
}

