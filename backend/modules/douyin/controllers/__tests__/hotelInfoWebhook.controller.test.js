const { handleDouyinHotelInfoWebhook } = require('../../services/hotelInfoWebhook.service')
const {
  clearWebhookMsgCacheForTest,
  receiveDouyinHotelInfoWebhookCallback,
} = require('../hotelInfoWebhook.controller')

jest.mock('../../services/hotelInfoWebhook.service', () => ({
  handleDouyinHotelInfoWebhook: jest.fn(),
}))

/**
 * 创建最小响应对象 mock。
 *
 * @returns {{json: jest.Mock}} 响应对象。
 */
function createMockResponse() {
  return {
    json: jest.fn(function json(body) {
      return body
    }),
  }
}

describe('receiveDouyinHotelInfoWebhookCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearWebhookMsgCacheForTest()
  })

  test('成功时应返回统一 success 结构', async () => {
    handleDouyinHotelInfoWebhook.mockResolvedValue({
      errorCode: 0,
      description: 'success',
      action: 'accepted',
    })

    const req = {
      body: {
        out_hotel_id: 'asuxiaozhu001',
      },
      headers: {
        'x-bytedance-logid': 'LOGID_HOTEL_001',
      },
    }
    const res = createMockResponse()

    await receiveDouyinHotelInfoWebhookCallback(req, res)

    expect(handleDouyinHotelInfoWebhook).toHaveBeenCalledWith({
      out_hotel_id: 'asuxiaozhu001',
    }, {
      douyinLogId: 'LOGID_HOTEL_001',
    })
    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 0,
        description: 'success',
      },
    })
  })

  test('失败时应返回统一错误结构', async () => {
    const error = new Error('invalid webhook payload')
    error.douyinErrorCode = 13
    error.douyinDescription = '缺少酒店标识'
    handleDouyinHotelInfoWebhook.mockRejectedValue(error)

    const req = {
      body: {},
    }
    const res = createMockResponse()

    await receiveDouyinHotelInfoWebhookCallback(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: {
        error_code: 13,
        description: '缺少酒店标识',
      },
    })
  })

  test('verify_webhook 事件应按原类型回传 challenge', async () => {
    const req = {
      body: {
        event: 'verify_webhook',
        content: {
          challenge: 1774519391,
        },
      },
    }
    const res = createMockResponse()

    await receiveDouyinHotelInfoWebhookCallback(req, res)

    expect(handleDouyinHotelInfoWebhook).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      challenge: 1774519391,
    })
  })

  test('重复 Msg-Id 消息应直接返回 success 且不重复处理', async () => {
    handleDouyinHotelInfoWebhook.mockResolvedValue({
      errorCode: 0,
      description: 'success',
      action: 'accepted',
    })

    const req = {
      body: {
        out_hotel_id: 'asuxiaozhu001',
      },
      headers: {
        'msg-id': 'MSG_ID_001',
      },
    }
    const res1 = createMockResponse()
    const res2 = createMockResponse()

    await receiveDouyinHotelInfoWebhookCallback(req, res1)
    await receiveDouyinHotelInfoWebhookCallback(req, res2)

    expect(handleDouyinHotelInfoWebhook).toHaveBeenCalledTimes(1)
    expect(res2.json).toHaveBeenCalledWith({
      data: {
        error_code: 0,
        description: 'success',
      },
    })
  })

  test('verify_webhook 且 content 为字符串JSON时应按原类型回传 challenge', async () => {
    const req = {
      body: {
        event: 'verify_webhook',
        content: '{"challenge":12345}',
      },
    }
    const res = createMockResponse()

    await receiveDouyinHotelInfoWebhookCallback(req, res)

    expect(handleDouyinHotelInfoWebhook).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      challenge: 12345,
    })
  })
})
