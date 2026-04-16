const { resolveDouyinBusinessError } = require('../utils/douyinError')
const {
  listDouyinRatePlansService,
} = require('../services/ratePlanList.service')

/**
 * 查询本地套餐的抖音同步列表。
 *
 * @param {import('express').Request} _req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function listDouyinRatePlansController(_req, res) {
  try {
    const data = await listDouyinRatePlansService()

    return res.json({
      success: true,
      code: 'DOUYIN_RATE_PLAN_LIST',
      data,
      message: '抖音套餐同步列表获取成功',
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
  listDouyinRatePlansController,
}
