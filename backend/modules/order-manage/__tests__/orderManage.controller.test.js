jest.mock('../orderManage.service', () => ({
  checkOut: jest.fn(),
  earlyCheckout: jest.fn(),
  getDepositInfo: jest.fn(),
  getEarlyCheckoutRecommendation: jest.fn(),
  getOrder: jest.fn(),
  listDailyOrders: jest.fn(),
  listOrders: jest.fn(),
  refundDeposit: jest.fn(),
  updateOrder: jest.fn(),
  updateOrderDayRoom: jest.fn(),
  updateOrderStatus: jest.fn(),
  updateOrderWithBills: jest.fn()
}));

const orderManageService = require('../orderManage.service');
const controller = require('../orderManage.controller');

function createReq({ params = {}, query = {}, body = {}, user } = {}) {
  return { params, query, body, user };
}

function createRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn()
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('订单管理 HTTP 调用', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('查询订单列表时，应当把归一化后的筛选条件传给 service', async () => {
    const req = createReq({ query: { search: ' 张三 ', status: 'pending', date: '2025-11-30' } });
    const res = createRes();
    orderManageService.listOrders.mockResolvedValue([{ order_id: 'ORDER_001' }]);

    await controller.listOrders(req, res);

    expect(orderManageService.listOrders).toHaveBeenCalledWith({
      search: '张三',
      status: 'pending',
      date: '2025-11-30'
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: [{ order_id: 'ORDER_001' }] });
  });

  test('修改订单状态时，应当校验参数后调用 service', async () => {
    const req = createReq({
      params: { orderNumber: 'ORDER_001' },
      body: { newStatus: 'checked-in' }
    });
    const res = createRes();
    orderManageService.updateOrderStatus.mockResolvedValue({ order_id: 'ORDER_001', status: 'checked-in' });

    await controller.updateOrderStatus(req, res);

    expect(orderManageService.updateOrderStatus).toHaveBeenCalledWith('ORDER_001', 'checked-in');
    expect(res.json).toHaveBeenCalledWith({
      message: '订单状态更新成功',
      order: { order_id: 'ORDER_001', status: 'checked-in' }
    });
  });

  test('每日换房时，应当把订单号、日期、房间号和登录用户传给 service', async () => {
    const user = { username: 'alice' };
    const req = createReq({
      params: { orderNumber: 'ORDER_001' },
      body: { stayDate: '2025-11-30', newRoomNumber: '101' },
      user
    });
    const res = createRes();
    orderManageService.updateOrderDayRoom.mockResolvedValue({ order_id: 'ORDER_001', room_number: '101' });

    await controller.updateOrderDayRoom(req, res);

    expect(orderManageService.updateOrderDayRoom).toHaveBeenCalledWith('ORDER_001', '2025-11-30', '101', user);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: '订单 ORDER_001 的 2025-11-30 房间已更换为 101',
      data: { order_id: 'ORDER_001', room_number: '101' }
    });
  });

  test('联合修改订单和账单时，应当把原始请求体交给 service 整理', async () => {
    const body = {
      orderData: { payment_method: '现金' },
      roomPrice: { '2025-11-30': 200 },
      changedBy: 'bob',
      roomFeePaymentSplits: [{ method: '现金', amount: 100 }],
      depositPaymentSplits: [{ method: '微信', amount: 50 }],
      depositPaymentMethod: '微信'
    };
    const req = createReq({
      params: { orderNumber: 'ORDER_001' },
      body
    });
    const res = createRes();
    orderManageService.updateOrderWithBills.mockResolvedValue({ success: true });

    await controller.updateOrderWithBills(req, res);

    expect(orderManageService.updateOrderWithBills).toHaveBeenCalledWith('ORDER_001', body);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('提前退房时，应当校验参数后把请求体和登录用户传给 service', async () => {
    const user = { username: 'alice' };
    const body = {
      actualCheckoutTime: '2026-01-11T09:00',
      refundAmount: 120,
      refundMethod: '现金',
      operator: 'front-desk',
      remarks: '提前离店',
      hasStayed: true
    };
    const req = createReq({
      params: { orderNumber: 'ORDER_001' },
      body,
      user
    });
    const res = createRes();
    orderManageService.earlyCheckout.mockResolvedValue({ order_id: 'ORDER_001' });

    await controller.earlyCheckout(req, res);

    expect(orderManageService.earlyCheckout).toHaveBeenCalledWith('ORDER_001', body, user);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
