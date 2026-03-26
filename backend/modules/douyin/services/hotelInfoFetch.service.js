const { douyinConfig } = require('../../../appSettings/douyin.config')
const { DOUYIN_COMMON_ERROR } = require('../constants/errorCodes')
const { requestDouyinOpenApi } = require('../clients/douyinOpenApi.client')
const { createDouyinBusinessError } = require('../utils/douyinError')

/**
 * 构建酒店自助匹配查询参数。
 *
 * @param {Object} params 查询参数。
 * @param {string} params.accountId 抖音商家账号 ID。
 * @param {number} [params.pageIndex=1] 页码（从 1 开始）。
 * @param {number} [params.pageSize=20] 每页条数（最大 100）。
 * @returns {{accountId:string, pageIndex:number, pageSize:number}} 规范化参数。
 */
function normalizeHotelInfoQueryParams({
  accountId,
  pageIndex = 1,
  pageSize = 20,
} = {}) {
  const normalizedAccountId = String(accountId || douyinConfig.accountId || '').trim()
  const normalizedPageIndex = Number(pageIndex)
  const normalizedPageSize = Number(pageSize)

  if (!normalizedAccountId) {
    throw createDouyinBusinessError(
      DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
      'Missing Douyin account_id',
      '缺少抖音商家账号ID'
    )
  }

  if (!Number.isInteger(normalizedPageIndex) || normalizedPageIndex < 1) {
    throw createDouyinBusinessError(
      DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
      `Invalid page_index: ${pageIndex}`,
      'pageIndex 必须为大于等于 1 的整数'
    )
  }

  if (!Number.isInteger(normalizedPageSize) || normalizedPageSize < 1 || normalizedPageSize > 100) {
    throw createDouyinBusinessError(
      DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
      `Invalid page_size: ${pageSize}`,
      'pageSize 必须为 1-100 的整数'
    )
  }

  return {
    accountId: normalizedAccountId,
    pageIndex: normalizedPageIndex,
    pageSize: normalizedPageSize,
  }
}

/**
 * 从抖音响应中提取酒店列表。
 *
 * @param {Object} result OpenAPI 响应结果。
 * @returns {Object[]} 酒店列表。
 */
function resolveHotelListFromResult(result = {}) {
  const hotelList = result?.data?.hotel_list
  return Array.isArray(hotelList) ? hotelList : []
}

/**
 * 从抖音响应中提取分页信息。
 *
 * @param {Object} result OpenAPI 响应结果。
 * @param {number} fallbackPageIndex 兜底页码。
 * @param {number} fallbackPageSize 兜底每页条数。
 * @returns {{page_index:number, page_size:number, page_count:number, total_count:number, has_more:boolean}} 分页对象。
 */
function resolvePaginationFromResult(result = {}, fallbackPageIndex, fallbackPageSize) {
  const rawPagination = result?.data?.pagination || {}
  const rawHasMore = rawPagination.has_more

  return {
    page_index: Number(rawPagination.page_index || fallbackPageIndex),
    page_size: Number(rawPagination.page_size || fallbackPageSize),
    page_count: Number(rawPagination.page_count || 0),
    total_count: Number(rawPagination.total_count || 0),
    has_more: rawHasMore === true,
  }
}

/**
 * 校验抖音接口返回是否成功。
 *
 * @param {Object} result OpenAPI 响应结果。
 * @returns {void}
 */
function assertHotelInfoQueryResult(result = {}) {
  const dataErrorCode = Number(result?.data?.error_code)
  const extraErrorCode = Number(result?.extra?.error_code)
  const hasDataError = Number.isFinite(dataErrorCode) && dataErrorCode !== 0
  const hasExtraError = Number.isFinite(extraErrorCode) && extraErrorCode !== 0

  if (!hasDataError && !hasExtraError) {
    return
  }

  const description =
    String(result?.data?.description || '').trim() ||
    String(result?.extra?.description || '').trim() ||
    '抖音酒店信息查询失败'

  throw createDouyinBusinessError(
    DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
    `Douyin hotel info query failed: ${description}`,
    description
  )
}

/**
 * 查询抖音酒店静态信息（模式二自助匹配）。
 *
 * @param {Object} params 查询参数。
 * @returns {Promise<{hotelList:Object[], pagination:Object, raw:Object}>} 查询结果。
 */
async function queryDouyinHotelInfo(params = {}) {
  const normalized = normalizeHotelInfoQueryParams(params)

  const result = await requestDouyinOpenApi({
    method: 'POST',
    path: '/goodlife/v1/trip/hotel/poi/query/',
    withAccountId: false,
    data: {
      account_id: normalized.accountId,
      page_index: normalized.pageIndex,
      page_size: normalized.pageSize,
    },
  })

  assertHotelInfoQueryResult(result)

  return {
    hotelList: resolveHotelListFromResult(result),
    pagination: resolvePaginationFromResult(result, normalized.pageIndex, normalized.pageSize),
    raw: result,
  }
}

/**
 * 批量拉取抖音酒店静态信息（模式二自助匹配）。
 *
 * @param {Object} params 同步参数。
 * @param {string} params.accountId 抖音商家账号 ID。
 * @param {number} [params.pageSize=50] 每页条数。
 * @param {number} [params.startPageIndex=1] 起始页码。
 * @param {number} [params.maxPages=20] 最多拉取页数，防止无限循环。
 * @returns {Promise<{summary:Object, hotels:Object[], pages:Object[]}>} 同步结果。
 */
async function syncDouyinHotelInfo({
  accountId,
  pageSize = 50,
  startPageIndex = 1,
  maxPages = 20,
} = {}) {
  const normalizedMaxPages = Number(maxPages)
  if (!Number.isInteger(normalizedMaxPages) || normalizedMaxPages < 1) {
    throw createDouyinBusinessError(
      DOUYIN_COMMON_ERROR.OTHER_EXCEPTION,
      `Invalid maxPages: ${maxPages}`,
      'maxPages 必须为大于等于 1 的整数'
    )
  }

  const hotels = []
  const pages = []
  let currentPage = Number(startPageIndex)

  for (let index = 0; index < normalizedMaxPages; index += 1) {
    const pageResult = await queryDouyinHotelInfo({
      accountId,
      pageIndex: currentPage,
      pageSize,
    })

    pages.push({
      pageIndex: pageResult.pagination.page_index,
      pageSize: pageResult.pagination.page_size,
      hasMore: pageResult.pagination.has_more,
      count: pageResult.hotelList.length,
    })
    hotels.push(...pageResult.hotelList)

    // has_more 为 false 时认为已经到末页。
    if (!pageResult.pagination.has_more) {
      break
    }

    currentPage += 1
  }

  const lastPage = pages[pages.length - 1]

  return {
    summary: {
      fetchedPages: pages.length,
      fetchedHotels: hotels.length,
      startPageIndex: Number(startPageIndex),
      endPageIndex: lastPage ? lastPage.pageIndex : Number(startPageIndex),
      hasMore: lastPage ? lastPage.hasMore : false,
    },
    hotels,
    pages,
  }
}

module.exports = {
  assertHotelInfoQueryResult,
  normalizeHotelInfoQueryParams,
  queryDouyinHotelInfo,
  resolveHotelListFromResult,
  resolvePaginationFromResult,
  syncDouyinHotelInfo,
}
