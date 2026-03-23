const axios = require('axios')
const { douyinConfig, validateDouyinConfig } = require('../../../appSettings/douyin.config')

let tokenCache = {
  accessToken: null,
  expireAt: 0,
}

// 防止并发重复请求 token
let fetchingTokenPromise = null

/**
 * 判断当前缓存的客户端 Token 是否有效
 */
function isTokenValid() {
  if (!tokenCache.accessToken) return false

  const now = Date.now()
  const buffer = 5 * 60 * 1000 // 5分钟缓冲

  return tokenCache.expireAt - buffer > now
}

/**
 * 实际请求抖音获取 token
 */
async function fetchClientTokenFromDouyin() {
  validateDouyinConfig()

  const url = `${douyinConfig.openApiBaseUrl}${douyinConfig.tokenPath}`

  const payload = {
    client_key: douyinConfig.clientKey,
    client_secret: douyinConfig.clientSecret,
    grant_type: 'client_credential',
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    const responseData = response.data || {}
    const data = responseData.data || {}

    if (!data.access_token) {
      throw new Error(`Invalid token response: ${JSON.stringify(responseData)}`)
    }

    const expiresIn = Number(data.expires_in || 7200)

    tokenCache = {
      accessToken: data.access_token,
      expireAt: Date.now() + expiresIn * 1000,
    }

    return tokenCache.accessToken
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Douyin token request failed: HTTP ${error.response.status} ${JSON.stringify(error.response.data)}`
      )
    }
    throw error
  }
}

/**
 * 获取 token（带缓存 + 并发控制）
 */
async function getClientToken() {
  if (isTokenValid()) {
    return tokenCache.accessToken
  }

  // 已有请求在进行中，复用
  if (fetchingTokenPromise) {
    return fetchingTokenPromise
  }

  fetchingTokenPromise = fetchClientTokenFromDouyin()
    .then((token) => {
      fetchingTokenPromise = null
      return token
    })
    .catch((err) => {
      fetchingTokenPromise = null
      throw err
    })

  return fetchingTokenPromise
}

/**
 * 强制刷新 token
 */
async function forceRefreshClientToken() {
  return fetchClientTokenFromDouyin()
}

/**
 * 获取缓存状态（调试用）
 */
function getTokenCacheInfo() {
  return {
    hasToken: Boolean(tokenCache.accessToken),
    expireAt: tokenCache.expireAt,
    now: Date.now(),
    isValid: isTokenValid(),
  }
}

module.exports = {
  getClientToken,
  forceRefreshClientToken,
  getTokenCacheInfo,
}
