process.env.APP_NAME = process.env.APP_NAME || 'test-app'
process.env.APP_URL = process.env.APP_URL || 'http://localhost'
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.NODE_PORT = process.env.NODE_PORT || '3000'
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost'
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432'
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'postgres'
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres'
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'hotel_test'
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost'
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379'
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'
process.env.EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.example.com'
process.env.EMAIL_PORT = process.env.EMAIL_PORT || '25'
process.env.EMAIL_USER = process.env.EMAIL_USER || 'user@example.com'
process.env.EMAIL_PW = process.env.EMAIL_PW || 'secret'

jest.mock('../database/postgreDB/pg', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}))

jest.mock('../modules/douyin/services/fulfillmentSync.service', () => ({
  isDouyinSystemOrder: jest.fn(),
  pushDouyinCheckInBySystemOrder: jest.fn(),
  pushDouyinCheckOutBySystemOrder: jest.fn(),
}))

const {
  triggerDouyinCheckInSyncIfNeeded,
  triggerDouyinCheckOutSyncIfNeeded,
} = require('../modules/orderModule')
const {
  isDouyinSystemOrder,
  pushDouyinCheckInBySystemOrder,
  pushDouyinCheckOutBySystemOrder,
} = require('../modules/douyin/services/fulfillmentSync.service')

describe('douyin fulfillment auto sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('抖音订单入住后应自动推送', async () => {
    isDouyinSystemOrder.mockResolvedValue(true)
    pushDouyinCheckInBySystemOrder.mockResolvedValue({ action: 'check_in', status: 'sent' })

    const result = await triggerDouyinCheckInSyncIfNeeded('O202603240001')

    expect(pushDouyinCheckInBySystemOrder).toHaveBeenCalledWith('O202603240001')
    expect(result).toEqual({ action: 'sent' })
  })

  test('非抖音订单入住时应跳过', async () => {
    isDouyinSystemOrder.mockResolvedValue(false)

    const result = await triggerDouyinCheckInSyncIfNeeded('O202603240002')

    expect(pushDouyinCheckInBySystemOrder).not.toHaveBeenCalled()
    expect(result).toEqual({ action: 'skip', reason: 'not_douyin_order' })
  })

  test('抖音订单退房后应自动推送', async () => {
    isDouyinSystemOrder.mockResolvedValue(true)
    pushDouyinCheckOutBySystemOrder.mockResolvedValue({ action: 'check_out', status: 'sent' })

    const result = await triggerDouyinCheckOutSyncIfNeeded('O202603240003')

    expect(pushDouyinCheckOutBySystemOrder).toHaveBeenCalledWith('O202603240003')
    expect(result).toEqual({ action: 'sent' })
  })

  test('自动推送失败时不抛错', async () => {
    isDouyinSystemOrder.mockResolvedValue(true)
    pushDouyinCheckOutBySystemOrder.mockRejectedValue(new Error('douyin api failed'))

    const result = await triggerDouyinCheckOutSyncIfNeeded('O202603240004')

    expect(result).toEqual({
      action: 'failed',
      error: 'douyin api failed',
    })
  })
})
