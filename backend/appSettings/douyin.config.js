
const douyinConfig = {
  clientKey: process.env.DOUYIN_CLIENT_KEY || '',
  clientSecret: process.env.DOUYIN_CLIENT_SECRET || '',
  accountId: process.env.DOUYIN_ACCOUNT_ID || '',
  openApiBaseUrl: process.env.DOUYIN_OPENAPI_BASE_URL || 'https://open.douyin.com',
  tokenPath: '/oauth/client_token/',
  autoConfirmEnabled: process.env.DOUYIN_AUTO_CONFIRM_ENABLED === 'true',
  poiId: process.env.DOUYIN_POI_ID || '',
}

function validateDouyinConfig() {
  const missingFields = []

  if (!douyinConfig.clientKey) missingFields.push('DOUYIN_CLIENT_KEY')
  if (!douyinConfig.clientSecret) missingFields.push('DOUYIN_CLIENT_SECRET')

  if (missingFields.length > 0) {
    throw new Error(`Missing Douyin config: ${missingFields.join(', ')}`)
  }
}

module.exports = {
  douyinConfig,
  validateDouyinConfig,

}
