const axios = require('axios')
const { douyinConfig } = require('../../../appSettings/douyin.config')
const { getClientToken } = require('../services/token.service')

// 创建一个 专门给抖音 OpenAPI 用的 axios 客户端实例
const douyinHttp = axios.create({
  baseURL: douyinConfig.openApiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 统一请求抖音 OpenAPI。
 * 功能：
 * 1. 校验接口路径是否存在；
 * 2. 自动获取并注入 access-token；
 * 3. 按需注入生活服务账号头（Rpc-Transit-Life-Account）；
 * 4. 发起 HTTP 请求并将响应转换为统一结构返回。
 */
async function requestDouyinOpenApi({
  method = 'POST',
  path,
  data = {},
  params = {},
  headers = {},
  withAccountId = false,
}) {
  if (!path) {
    throw new Error('Douyin OpenAPI path is required')
  }

  const accessToken = await getClientToken()

  const finalHeaders = {
    'access-token': accessToken,
    ...headers,
  }
  // 按需附加账号头（部分接口要求）
  if (withAccountId && douyinConfig.accountId) {
    finalHeaders['Rpc-Transit-Life-Account'] = douyinConfig.accountId
  }

  console.log('👉 Douyin request url:', `${douyinConfig.openApiBaseUrl}${path}`)

  const response = await douyinHttp.request({
    url: path,
    method,
    data,
    params,
    headers: finalHeaders,
  })

  const responseData = response.data || {}

  return {
    success: response.status >= 200 && response.status < 300,
    httpStatus: response.status,
    raw: responseData,
    data: responseData.data || null,
    extra: responseData.extra || null,
    baseResp: responseData.base_resp || null,
  }
}

module.exports = {
  requestDouyinOpenApi,
}
