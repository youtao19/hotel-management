const { douyinConfig } = require('../../../appSettings/douyin.config')
const { resolveDouyinBusinessError } = require('../utils/douyinError')
const {
  queryDouyinHotelInfo,
  syncDouyinHotelInfo,
} = require('../services/hotelInfoFetch.service')

/**
 * 解析酒店静态信息查询请求体。
 *
 * @param {Object} body 请求体。
 * @returns {{accountId:string, pageIndex:number, pageSize:number}} 规范化参数。
 */
function resolveHotelInfoQueryBody(body = {}) {
  return {
    accountId: String(body.accountId || douyinConfig.accountId || '').trim(),
    pageIndex: body.pageIndex === undefined ? 1 : Number(body.pageIndex),
    pageSize: body.pageSize === undefined ? 20 : Number(body.pageSize),
  }
}

/**
 * 解析酒店静态信息同步请求体。
 *
 * @param {Object} body 请求体。
 * @returns {{accountId:string, pageSize:number, startPageIndex:number, maxPages:number}} 规范化参数。
 */
function resolveHotelInfoSyncBody(body = {}) {
  return {
    accountId: String(body.accountId || douyinConfig.accountId || '').trim(),
    pageSize: body.pageSize === undefined ? 50 : Number(body.pageSize),
    startPageIndex: body.startPageIndex === undefined ? 1 : Number(body.startPageIndex),
    maxPages: body.maxPages === undefined ? 20 : Number(body.maxPages),
  }
}

/**
 * 查询单页酒店静态信息（模式二）。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function queryDouyinHotelInfoController(req, res) {
  try {
    const payload = resolveHotelInfoQueryBody(req.body || {})
    const result = await queryDouyinHotelInfo(payload)

    return res.json({
      success: true,
      summary: {
        fetchedHotels: result.hotelList.length,
        pageIndex: result.pagination.page_index,
        pageSize: result.pagination.page_size,
        hasMore: result.pagination.has_more,
      },
      pagination: result.pagination,
      data: result.hotelList,
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
 * 批量同步酒店静态信息（模式二）。
 *
 * @param {import('express').Request} req 请求对象。
 * @param {import('express').Response} res 响应对象。
 * @returns {Promise<import('express').Response>} 响应结果。
 */
async function syncDouyinHotelInfoController(req, res) {
  try {
    const payload = resolveHotelInfoSyncBody(req.body || {})
    const result = await syncDouyinHotelInfo(payload)

    return res.json({
      success: true,
      summary: result.summary,
      pages: result.pages,
      data: result.hotels,
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
  queryDouyinHotelInfoController,
  resolveHotelInfoQueryBody,
  resolveHotelInfoSyncBody,
  syncDouyinHotelInfoController,
}
