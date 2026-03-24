const { generateOrderNumber } = require('../../../tools')
const {
  findByOtaOrderId,
  createDouyinOrder,
  updateDouyinOrderByOtaOrderId,
} = require('../../repositories/douyinOrder.repository')
const {
  findDouyinPresaleOrderByOtaOrderId,
  createDouyinPresaleOrder,
  updateDouyinPresaleOrderByOtaOrderId,
  bindPresaleOrderOutIdToDouyinOrder,
} = require('../../repositories/douyinPresaleOrder.repository')
const { handleDouyinPresaleBooking } = require('../presaleBooking.service')

jest.mock('../../../tools', () => ({
  generateOrderNumber: jest.fn(),
}))

jest.mock('../../repositories/douyinOrder.repository', () => ({
  findByOtaOrderId: jest.fn(),
  createDouyinOrder: jest.fn(),
  updateDouyinOrderByOtaOrderId: jest.fn(),
}))

jest.mock('../../repositories/douyinPresaleOrder.repository', () => ({
  findDouyinPresaleOrderByOtaOrderId: jest.fn(),
  createDouyinPresaleOrder: jest.fn(),
  updateDouyinPresaleOrderByOtaOrderId: jest.fn(),
  bindPresaleOrderOutIdToDouyinOrder: jest.fn(),
}))

describe('handleDouyinPresaleBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('新预售订单应创建抖音落地单和本地预售单，并返回 order_out_id', async () => {
    generateOrderNumber.mockReturnValue('O202603240001')
    findByOtaOrderId.mockResolvedValue(null)
    findDouyinPresaleOrderByOtaOrderId.mockResolvedValue(null)
    createDouyinOrder.mockResolvedValue({
      ota_order_id: 'DY_PRE_001',
      system_order_id: null,
    })
    createDouyinPresaleOrder.mockResolvedValue({
      order_id: 'O202603240001',
      ota_order_id: 'DY_PRE_001',
    })
    bindPresaleOrderOutIdToDouyinOrder.mockResolvedValue({
      ota_order_id: 'DY_PRE_001',
      system_order_id: 'O202603240001',
    })

    const result = await handleDouyinPresaleBooking({
      order_id: 'DY_PRE_001',
      biz_type: 2011,
      pre_sale_coupon_id: 'COUPON_001',
      rate_plan_id: 'RATE_001',
      coupon_count: 1,
      total_amount: 1000,
      contact_info: {
        name: '王五',
        phone: '13700000000',
      },
    }, {
      douyinLogId: 'LOGID_PRE_001',
    })

    expect(createDouyinOrder).toHaveBeenCalledWith(expect.objectContaining({
      otaOrderId: 'DY_PRE_001',
      bizType: 2011,
      douyinLogId: 'LOGID_PRE_001',
      systemOrderId: 'O202603240001',
    }))
    expect(createDouyinPresaleOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'O202603240001',
      otaOrderId: 'DY_PRE_001',
      preSaleCouponId: 'COUPON_001',
      ratePlanId: 'RATE_001',
    }))
    expect(bindPresaleOrderOutIdToDouyinOrder).toHaveBeenCalledWith('DY_PRE_001', 'O202603240001')
    expect(result).toMatchObject({
      action: 'created',
      orderOutId: 'O202603240001',
      presaleOrder: {
        order_id: 'O202603240001',
      },
    })
  })

  test('重复预售订单应更新并复用已有 order_out_id', async () => {
    findByOtaOrderId.mockResolvedValue({ ota_order_id: 'DY_PRE_001' })
    findDouyinPresaleOrderByOtaOrderId.mockResolvedValue({
      order_id: 'O202603240009',
      ota_order_id: 'DY_PRE_001',
    })
    updateDouyinOrderByOtaOrderId.mockResolvedValue({
      ota_order_id: 'DY_PRE_001',
    })
    updateDouyinPresaleOrderByOtaOrderId.mockResolvedValue({
      order_id: 'O202603240009',
      ota_order_id: 'DY_PRE_001',
    })
    bindPresaleOrderOutIdToDouyinOrder.mockResolvedValue({})

    const result = await handleDouyinPresaleBooking({
      order_id: 'DY_PRE_001',
      biz_type: 2011,
      pre_sale_coupon_id: 'COUPON_001',
      rate_plan_id: 'RATE_001',
      coupon_count: 2,
      total_amount: 2000,
    })

    expect(generateOrderNumber).not.toHaveBeenCalled()
    expect(updateDouyinPresaleOrderByOtaOrderId).toHaveBeenCalledWith(
      'DY_PRE_001',
      expect.objectContaining({
        orderId: 'O202603240009',
      })
    )
    expect(result.action).toBe('updated')
    expect(result.orderOutId).toBe('O202603240009')
  })

  test('biz_type 非 2011 时应返回预售业务类型错误', async () => {
    await expect(handleDouyinPresaleBooking({
      order_id: 'DY_PRE_002',
      biz_type: 2021,
      pre_sale_coupon_id: 'COUPON_001',
      rate_plan_id: 'RATE_001',
      coupon_count: 1,
      total_amount: 1000,
    })).rejects.toMatchObject({
      douyinErrorCode: 13,
      douyinDescription: '预售业务类型不合法',
    })
  })
})
