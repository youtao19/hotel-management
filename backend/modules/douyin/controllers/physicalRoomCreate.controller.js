const { douyinConfig } = require('../../../appSettings/douyin.config')
const { resolveDouyinBusinessError } = require('../utils/douyinError')
const { createDouyinPhysicalRoom } = require('../services/physicalRoomCreate.service')

/**
 * 提取创建物理房型所需参数。
 *
 * @param {Object} body 请求体。
 * @returns {{localRoomType:string, accountId:string, poiId:string, categoryId:string, images:unknown[]}} 参数对象。
 */
function resolvePhysicalRoomCreateBody(body = {}) {
  return {
    localRoomType: String(body.localRoomType || '').trim(),
    accountId: String(body.accountId || douyinConfig.accountId || '').trim(),
    poiId: String(body.poiId || '').trim(),
    categoryId: String(body.categoryId || '').trim(),
    images: Array.isArray(body.images) ? body.images : body.images === undefined ? [] : body.images,
  }
}

/**
 * 手动创建抖音物理房型。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function createDouyinPhysicalRoomController(req, res) {
  const payload = resolvePhysicalRoomCreateBody(req.body || {})

  if (!payload.localRoomType) {
    return res.status(400).json({
      success: false,
      message: 'localRoomType is required',
    })
  }

  if (!payload.poiId) {
    return res.status(400).json({
      success: false,
      message: 'poiId is required',
    })
  }

  if (!payload.categoryId) {
    return res.status(400).json({
      success: false,
      message: 'categoryId is required',
    })
  }

  if (!payload.accountId) {
    return res.status(400).json({
      success: false,
      message: 'accountId is required',
    })
  }

  if (!Array.isArray(payload.images) || payload.images.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'images is required',
    })
  }

  try {
    const result = await createDouyinPhysicalRoom(payload)

    return res.json({
      success: true,
      action: result.action,
      roomId: result.roomId,
      payload: result.payload,
      saveResult: result.saveResult,
      detailResult: result.detailResult,
      savedRoom: result.savedRoom,
      savedMapping: result.savedMapping,
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
  createDouyinPhysicalRoomController,
  resolvePhysicalRoomCreateBody,
}
