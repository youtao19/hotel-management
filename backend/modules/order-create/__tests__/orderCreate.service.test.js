jest.mock('../orderCreate.repository', () => ({
  getClient: jest.fn(),
  insertOrderDay: jest.fn(),
  listBillsByOrderId: jest.fn(),
  listOrderRowsForCheckIn: jest.fn(),
  listStayDates: jest.fn(),
  updateOrderDeposit: jest.fn(),
  updateOrderPaymentMethod: jest.fn(),
  updateOrderStatus: jest.fn(),
  updateRoomStatus: jest.fn()
}));

jest.mock('../../order-manage/orderManage.repository', () => ({
  findOrderRowsByOrderId: jest.fn()
}));

jest.mock('../../bill/bill.service', () => ({
  addBill: jest.fn()
}));

const billService = require('../../bill/bill.service');
const orderCreateRepository = require('../orderCreate.repository');
const orderManageRepository = require('../../order-manage/orderManage.repository');
const orderCreateService = require('../orderCreate.service');

describe('创建订单业务服务', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('创建订单时，应当按住宿日期写入每天一条订单记录', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    const orderData = {
      orderId: 'ORDER_001',
      sourceNumber: 'SRC_001',
      orderSource: '美团',
      guestName: '张三',
      phone: '13812345678',
      roomType: 'xing_yun_ge',
      roomNumber: '403',
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-03',
      status: 'pending',
      paymentMethod: '微信',
      roomPrice: {
        '2025-11-01': 100,
        '2025-11-02': 120
      },
      deposit: 200,
      isPrepaid: true,
      prepaidAmount: 50,
      stayType: '客房',
      remarks: '安静房间'
    };
    orderCreateRepository.getClient.mockResolvedValue(client);
    orderCreateRepository.listStayDates.mockResolvedValue(['2025-11-01', '2025-11-02']);
    orderCreateRepository.insertOrderDay.mockResolvedValue({ rows: [{}] });

    await expect(orderCreateService.createOrder(orderData)).resolves.toEqual({ orderId: 'ORDER_001' });

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(orderCreateRepository.listStayDates).toHaveBeenCalledWith('2025-11-01', '2025-11-03', client);
    expect(orderCreateRepository.insertOrderDay).toHaveBeenCalledTimes(2);
    expect(orderCreateRepository.insertOrderDay.mock.calls[0][1][15]).toBe(50);
    expect(orderCreateRepository.insertOrderDay.mock.calls[1][1][15]).toBe(0);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('生成多日定价拆分时，应当通过 repository 读取住宿日期', async () => {
    const payload = {
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-03',
      mode: 'from-room-price',
      basePrice: 100
    };
    orderCreateRepository.listStayDates.mockResolvedValue(['2025-11-01', '2025-11-02']);

    await expect(orderCreateService.getPricingBreakdown(payload)).resolves.toEqual({
      stay_dates: ['2025-11-01', '2025-11-02'],
      daily_prices: {
        '2025-11-01': 100,
        '2025-11-02': 100
      },
      total_price: 200,
      average_price: 100,
      is_rest_room: false
    });
    expect(orderCreateRepository.listStayDates).toHaveBeenCalledWith('2025-11-01', '2025-11-03');  });

  test('休息房生成定价拆分时，应当保持半价规则且不查询日期序列', async () => {
    await expect(orderCreateService.getPricingBreakdown({
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-01',
      mode: 'from-room-price',
      basePrice: 100
    })).resolves.toEqual({
      stay_dates: ['2025-11-01'],
      daily_prices: { '2025-11-01': 50 },
      total_price: 50,
      average_price: 50,
      is_rest_room: true
    });
    expect(orderCreateRepository.listStayDates).not.toHaveBeenCalled();
  });

  test('办理入住时，应当更新订单房态并生成押金和房费账单', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    const paymentSplitPayload = {
      depositPaymentMethod: '微信'
    };
    orderCreateRepository.getClient.mockResolvedValue(client);
    orderCreateRepository.listOrderRowsForCheckIn.mockResolvedValue([
      {
        id: 1,
        order_id: 'ORDER_001',
        room_number: '403',
        guest_name: '张三',
        stay_date: '2025-11-01',
        check_in_date: '2025-11-01',
        total_price: 100,
        deposit: 0,
        payment_method: '现金',
        stay_type: '客房',
        status: 'pending'
      }
    ]);
    billService.addBill
      .mockResolvedValueOnce({ bill_id: 1, change_type: '收押' })
      .mockResolvedValueOnce({ bill_id: 2, change_type: '房费' });

    await expect(orderCreateService.checkIn('ORDER_001', 200, paymentSplitPayload)).resolves.toEqual([
      { bill_id: 1, change_type: '收押' },
      { bill_id: 2, change_type: '房费' }
    ]);

    expect(orderCreateRepository.updateOrderDeposit).toHaveBeenCalledWith(client, 1, 200);
    expect(orderCreateRepository.updateOrderStatus).toHaveBeenCalledWith(client, 'ORDER_001', 'checked-in');
    expect(orderCreateRepository.updateRoomStatus).toHaveBeenCalledWith(client, '403', 'occupied');
    expect(billService.addBill).toHaveBeenCalledTimes(2);
    expect(billService.addBill.mock.calls[0][0]).toMatchObject({
      change_type: '收押',
      pay_way: '微信',
      change_price: 200
    });
    expect(billService.addBill.mock.calls[1][0]).toMatchObject({
      change_type: '房费',
      pay_way: '现金',
      change_price: 100
    });
  });

  test('快速入住时，应当在同一个事务里创建订单并办理入住', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    const orderData = {
      orderId: 'ORDER_FAST_001',
      sourceNumber: 'SRC_001',
      orderSource: '美团',
      guestName: '张三',
      phone: '13812345678',
      roomType: 'xing_yun_ge',
      roomNumber: '403',
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-02',
      paymentMethod: '微信',
      roomPrice: {
        '2025-11-01': 100
      },
      deposit: 0,
      stayType: '客房'
    };
    orderCreateRepository.getClient.mockResolvedValue(client);
    orderCreateRepository.listStayDates.mockResolvedValue(['2025-11-01']);
    orderCreateRepository.insertOrderDay.mockResolvedValue({ rows: [{}] });
    orderCreateRepository.listOrderRowsForCheckIn.mockResolvedValue([
      {
        id: 1,
        order_id: 'ORDER_FAST_001',
        room_number: '403',
        guest_name: '张三',
        stay_date: '2025-11-01',
        check_in_date: '2025-11-01',
        total_price: 100,
        deposit: 0,
        payment_method: '微信',
        stay_type: '客房',
        status: 'pending'
      }
    ]);
    billService.addBill.mockResolvedValue({ bill_id: 1, change_type: '房费' });
    orderManageRepository.findOrderRowsByOrderId.mockResolvedValue({ order_id: 'ORDER_FAST_001' });
    orderCreateRepository.listBillsByOrderId.mockResolvedValue([{ bill_id: 1 }]);

    await expect(orderCreateService.fastCheckIn(orderData, 'alice')).resolves.toEqual({
      order: { order_id: 'ORDER_FAST_001' },
      bills: [{ bill_id: 1 }]
    });
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(orderCreateRepository.insertOrderDay).toHaveBeenCalledTimes(1);
    expect(orderCreateRepository.updateOrderStatus).toHaveBeenCalledWith(client, 'ORDER_FAST_001', 'checked-in');
  });
});
