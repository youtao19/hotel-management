const { resolveDouyinBusinessError } = require('../utils/douyinError')
const {
  listDouyinRoomTypeMappingsService,
  saveDouyinRoomTypeMappingsService,
} = require('../services/roomTypeMappingManage.service')

/**
 * 把请求中的 mappings 统一转为数组结构，避免前端做复杂转换。
 *
 * @param {unknown} mappingsRaw 请求体中的 mappings 字段。
 * @returns {Array<{douyinRoomId:string, douyinRoomName:string, localRoomType:string}>} 标准映射列表。
 */
function resolveRoomTypeMappingsBody(mappingsRaw) {
  if (Array.isArray(mappingsRaw)) {
    return mappingsRaw.map((item = {}) => ({
      douyinRoomId: String(item.douyinRoomId || item.roomId || '').trim(),
      douyinRoomName: String(item.douyinRoomName || item.roomName || '').trim(),
      localRoomType: String(item.localRoomType || item.value || '').trim(),
    }))
  }

  if (mappingsRaw && typeof mappingsRaw === 'object') {
    return Object.entries(mappingsRaw).map(([douyinRoomId, item = {}]) => ({
      douyinRoomId: String(douyinRoomId || '').trim(),
      douyinRoomName: String(item.douyinRoomName || item.label || '').trim(),
      localRoomType: String(item.localRoomType || item.value || '').trim(),
    }))
  }

  return []
}

/**
 * 查询抖音房型映射列表。
 *
 * @param {import('express').Request} _req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function listDouyinRoomTypeMappingsController(_req, res) {
  try {
    const data = await listDouyinRoomTypeMappingsService()
    return res.json({
      success: true,
      code: 'DOUYIN_ROOM_TYPE_MAPPING_LIST',
      data,
      message: '抖音房型映射列表获取成功',
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

/**
 * 批量保存抖音房型映射。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function saveDouyinRoomTypeMappingsController(req, res) {
  try {
    const mappings = resolveRoomTypeMappingsBody(req?.body?.mappings)
    const data = await saveDouyinRoomTypeMappingsService({ mappings })

    return res.json({
      success: true,
      code: 'DOUYIN_ROOM_TYPE_MAPPING_SAVED',
      data,
      message: '抖音房型映射保存成功',
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
  listDouyinRoomTypeMappingsController,
  resolveRoomTypeMappingsBody,
  saveDouyinRoomTypeMappingsController,
}
