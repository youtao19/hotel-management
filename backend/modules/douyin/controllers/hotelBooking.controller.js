const { forceRefreshClientToken, getTokenCacheInfo } = require('../services/token.service')
const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const { handleDouyinHotelBooking } = require('../services/hotelBooking.service')
const { syncDouyinOrderToSystem } = require('../services/orderSync.service')
const { autoConfirmDouyinOrder } = require('../services/autoConfirm.service')


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

async function receiveSpiCallback(req, res) {
  try {
    const result = await handleDouyinHotelBooking(req.body || {})

    const otaOrderId = result.order?.ota_order_id

    let syncResult = null
    let autoConfirmResult = null
    let autoConfirmError = null

    if (otaOrderId) {
      syncResult = await syncDouyinOrderToSystem(otaOrderId)
    }

    if (
      douyinConfig.autoConfirmEnabled &&
      result.action === 'created' && result.order && syncResult?.action === 'created') {
      try {
        autoConfirmResult = await autoConfirmDouyinOrder(result.order)
      } catch (error) {
        autoConfirmError = error.message
      }
    }

    return res.json({
      success: true,
      message: 'Douyin callback processed successfully',
      result,
      syncResult,
      autoConfirmResult,
      autoConfirmError,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to process Douyin callback',
      error: error.message,
    })
  }
}

module.exports = {
  refreshClientToken,
  testOpenApi,
  receiveSpiCallback,
}
