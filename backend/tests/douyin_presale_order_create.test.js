jest.mock('../modules/douyin/presale-order/presaleOrder.repository', () => ({
  findByDouyinOrderId: jest.fn(),
  findVoucherByDouyinId: jest.fn(),
  insertOrder: jest.fn()
}));

jest.mock('../modules/douyin/availability/bookableCheck.service', () => ({
  checkBookable: jest.fn()
}));

const repository = require('../modules/douyin/presale-order/presaleOrder.repository');
const { createOrder } = require('../modules/douyin/presale-order/presaleOrder.service');

/** 构造不含预约信息的抖音预售券创单请求。 */
function buildPayload(overrides = {}) {
  return {
    order_id: 'DY_PRESALE_CREATE_001',
    pre_sale_coupon_id: 'DY_VOUCHER_CREATE_001',
    total_coupon_count: 1,
    each_coupon_amount: 900,
    total_amount: 900,
    biz_type: 2011,
    ...overrides
  };
}

describe('抖音预售券创单支付状态', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findByDouyinOrderId.mockResolvedValue(null);
    repository.findVoucherByDouyinId.mockResolvedValue({ id: 1 });
    repository.insertOrder.mockImplementation(async (order) => ({
      order_id: order.localOrderId,
      ota_order_id: order.douyinOrderId
    }));
  });

  test('支付后创单携带 pay_info 时直接保存为已支付', async () => {
    await createOrder(buildPayload({ pay_info: { pay_time_unix: 1786340702 } }));

    expect(repository.insertOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderStage: 'PAID',
      mappedPayload: expect.objectContaining({
        paymentInfo: { payTimeUnix: 1786340702 }
      })
    }));
  });

  test('两步创单未携带 pay_info 时保持待支付', async () => {
    await createOrder(buildPayload());

    expect(repository.insertOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderStage: 'CREATED',
      mappedPayload: expect.objectContaining({ paymentInfo: null })
    }));
  });
});
