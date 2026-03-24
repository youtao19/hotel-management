const { resolveDouyinBusinessError } = require('../utils/douyinError')
const { toggleDouyinPhysicalRoomActive } = require('../services/physicalRoomStatus.service')

/**
 * 提取物理房型上下架请求参数。
 *
 * @param {Object} body 请求体。
 * @returns {{roomId:string, accountId:string, active:boolean|null}} 参数对象。
 */
function resolvePhysicalRoomStatusBody(body = {}) {
  return {
    roomId: String(body.roomId || '').trim(),
    accountId: body.accountId === undefined ? '' : String(body.accountId || '').trim(),
    active: typeof body.active === 'boolean' ? body.active : null,
  }
}

/**
 * 手动物理房型上下架。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function updateDouyinPhysicalRoomStatusController(req, res) {
  const payload = resolvePhysicalRoomStatusBody(req.body || {})

  if (!payload.roomId) {
    return res.status(400).json({
      success: false,
      message: 'roomId is required',
    })
  }

  if (payload.active === null) {
    return res.status(400).json({
      success: false,
      message: 'active must be boolean',
    })
  }

  try {
    const result = await toggleDouyinPhysicalRoomActive(payload)

    return res.json({
      success: true,
      action: result.action,
      status: result.status,
      payload: result.payload,
      result: result.result,
      savedRoom: result.savedRoom,
    })
  } catch (error) {
    const { errorCode, description } = resolveDouyinBusinessError(error)

    return res.status(400).json({
      success: false,
      errorCode,
      message: description,
    })
  }
}

module.exports = {
  resolvePhysicalRoomStatusBody,
  updateDouyinPhysicalRoomStatusController,
}
