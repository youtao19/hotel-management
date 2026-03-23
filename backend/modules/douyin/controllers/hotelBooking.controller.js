const { forceRefreshClientToken, getTokenCacheInfo } = require('../services/token.service')
const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const { handleDouyinHotelBooking } = require('../services/hotelBooking.service')
const { syncDouyinOrderToSystem } = require('../services/orderSync.service')
const { autoConfirmDouyinOrder } = require('../services/autoConfirm.service')
const { douyinConfig } = require('../../../appSettings/douyin.config')

/**
 * 从抖音回调请求体中提取订单号。
 *
 * @param {Object} payload 抖音原始回调体。
 * @returns {string} 提取到的抖音订单号；不存在时返回空字符串。
 */
function resolveDouyinOrderId(payload = {}) {
  return String(
    payload?.order_id ||
    payload?.data?.order_id ||
    payload?.order?.order_id ||
    ''
  ).trim()
}

/**
 * 构建抖音创单成功响应。
 *
 * @param {Object} params 成功响应参数。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {string|null} params.systemOrderId 本地系统订单号。
 * @returns {{data: Object}} 符合官方文档的成功响应体。
 */
function buildDouyinSuccessResponse({ otaOrderId, systemOrderId }) {
  return {
    data: {
      error_code: 0,
      description: 'success',
      order_id: otaOrderId,
      order_out_id: systemOrderId || '',
      confirm_info: {
        confirm_mode: 2,
      },
    },
  }
}

/**
 * 构建抖音创单失败响应。
 *
 * @param {Object} params 失败响应参数。
 * @param {string} params.otaOrderId 抖音订单号。
 * @param {number} params.errorCode 抖音错误码。
 * @param {string} params.description 错误描述。
 * @returns {{data: Object}} 符合官方文档的失败响应体。
 */
function buildDouyinErrorResponse({ otaOrderId, errorCode, description }) {
  return {
    data: {
      error_code: errorCode,
      description,
      order_id: otaOrderId,
    },
  }
}

/**
 * 手动刷新抖音开放平台 client_token。
 *
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<import('express').Response>} 刷新结果响应。
 * @throws {Error} token 刷新异常时由控制器统一返回 500。
 */
async function refreshClientToken(req, res) {
  try {
    const token = await forceRefreshClientToken()

    return res.json({
      success: true,
      message: 'Douyin client token refreshed successfully',
      accessToken: token,
      tokenCache: getTokenCacheInfo(),
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh Douyin client token',
      error: error.message,
    })
  }
}

/**
 * 调试调用抖音 OpenAPI。
 *
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<import('express').Response>} 调试请求结果。
 * @throws {Error} 调用异常时由控制器统一返回 500。
 */
async function testOpenApi(req, res) {
  try {
    const {
      method = 'POST',
      path,
      data = {},
      params = {},
      withAccountId = false,
    } = req.body || {}

    if (!path) {
      return res.status(400).json({
        success: false,
        message: 'path is required',
      })
    }

    const result = await requestDouyinOpenApi({
      method,
      path,
      data,
      params,
      withAccountId,
    })

    return res.json({
      success: true,
      message: 'Douyin OpenAPI request finished',
      request: {
        method,
        path,
        data,
        params,
        withAccountId,
      },
      result,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Douyin OpenAPI request failed',
      error: error.message,
    })
  }
}

/**
 * 接收抖音 SPI 回调并完成落库、同步和自动确认。
 * 说明：
 * 1. 响应体按抖音“酒店创建订单”官方文档输出；
 * 2. 订单创建成功后统一走异步确认模式 confirm_mode=2；
 * 3. 自动确认仅作为内部补充动作，不影响创单接口返回结构。
 *
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<import('express').Response>} 回调处理结果。
 */
async function receiveSpiCallback(req, res) {
  const otaOrderId = resolveDouyinOrderId(req.body || {})

  try {
    const result = await handleDouyinHotelBooking(req.body || {})

    /** @type {string} 实际落地抖音订单号。 */
    const finalOtaOrderId = result.order?.ota_order_id || otaOrderId
    /** @type {{action:string, systemOrderId:string|null}|null} 系统订单同步结果。 */
    let syncResult = null

    if (finalOtaOrderId) {
      syncResult = await syncDouyinOrderToSystem(finalOtaOrderId)
    }

    if (
      douyinConfig.autoConfirmEnabled &&
      result.action === 'created' &&
      result.order &&
      syncResult?.action === 'created'
    ) {
      try {
        await autoConfirmDouyinOrder(result.order)
      } catch (error) {
        console.error('[receiveSpiCallback] auto confirm failed:', error.message)
      }
    }

    return res.json(buildDouyinSuccessResponse({
      otaOrderId: finalOtaOrderId,
      systemOrderId: syncResult?.systemOrderId || result.order?.system_order_id || '',
    }))
  } catch (error) {
    /** @type {number} 抖音业务错误码。 */
    const errorCode = Number.isInteger(error?.douyinErrorCode) ? error.douyinErrorCode : 13
    /** @type {string} 抖音业务错误描述。 */
    const description = error?.douyinDescription || '其他异常'

    console.error('[receiveSpiCallback] failed:', error.message)

    return res.json(buildDouyinErrorResponse({
      otaOrderId,
      errorCode,
      description,
    }))
  }
}

module.exports = {
  refreshClientToken,
  testOpenApi,
  receiveSpiCallback,
}
