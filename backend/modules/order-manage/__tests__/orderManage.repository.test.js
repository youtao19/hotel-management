jest.mock('../../../database/postgreDB/pg', () => ({
  getClient: jest.fn(),
  query: jest.fn()
}));

const { query } = require('../../../database/postgreDB/pg');
const orderManageRepository = require('../orderManage.repository');

describe('订单管理数据访问', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('兼容启动检查时，应当查询 orders 表是否存在', async () => {
    query.mockResolvedValue({ rows: [{ exists: true }] });

    await expect(orderManageRepository.checkOrderTableExists())
      .resolves.toEqual({ rows: [{ exists: true }] });

    expect(query.mock.calls[0][0]).toContain("table_name = 'orders'");
  });

  test('查询订单列表时，应当把搜索、状态和日期转换成 SQL 参数', async () => {
    query.mockResolvedValue({ rows: [{ order_id: 'ORDER_001' }] });

    await expect(orderManageRepository.listOrders({
      search: '张三',
      status: 'pending',
      date: '2025-11-30'
    })).resolves.toEqual([{ order_id: 'ORDER_001' }]);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(['%张三%', 'pending', '2025-11-30']);
  });

  test('查询订单列表时，非法日期不要继续作为日期筛选参数下传', async () => {
    query.mockResolvedValue({ rows: [] });

    await orderManageRepository.listOrders({ date: '2025/11/30' });

    expect(query.mock.calls[0][1]).toEqual([null, null, null]);
  });

  test('查询每日订单明细时，应当按订单号和住宿日期排序', async () => {
    query.mockResolvedValue({ rows: [{ order_id: 'ORDER_001', stay_date: '2025-11-30' }] });

    await expect(orderManageRepository.listDailyOrders())
      .resolves.toEqual([{ order_id: 'ORDER_001', stay_date: '2025-11-30' }]);

    expect(query).toHaveBeenCalledWith('SELECT * FROM orders ORDER BY order_id, stay_date');
  });

  test('查询订单详情时，找不到订单应当返回 null', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(orderManageRepository.findOrderRowsByOrderId('ORDER_MISSING')).resolves.toBeNull();

    expect(query).toHaveBeenCalledWith(
      'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date',
      ['ORDER_MISSING']
    );
  });

  test('查询单条订单日记录时，找不到记录应当返回 null', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(orderManageRepository.findOrderRowById(123)).resolves.toBeNull();

    expect(query).toHaveBeenCalledWith('SELECT * FROM orders WHERE id = $1', [123]);
  });

  test('修改订单状态时，应当更新同一 order_id 下的所有日记录并返回第一条记录', async () => {
    query.mockResolvedValue({
      rows: [
        { order_id: 'ORDER_001', stay_date: '2025-11-30', status: 'checked-in' },
        { order_id: 'ORDER_001', stay_date: '2025-12-01', status: 'checked-in' }
      ]
    });

    await expect(orderManageRepository.updateOrderStatus('ORDER_001', 'checked-in'))
      .resolves.toEqual({ order_id: 'ORDER_001', stay_date: '2025-11-30', status: 'checked-in' });

    expect(query).toHaveBeenCalledWith(
      'UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *',
      ['checked-in', 'ORDER_001']
    );
  });

  test('修改订单状态时，找不到订单应当返回 null', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(orderManageRepository.updateOrderStatus('ORDER_MISSING', 'cancelled')).resolves.toBeNull();
  });

  test('修改订单基础信息时，应当读取同一订单的所有日记录', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rows: [{ order_id: 'ORDER_001' }] }) };

    await expect(orderManageRepository.findOrderRowsForUpdate(runner, 'ORDER_001'))
      .resolves.toEqual([{ order_id: 'ORDER_001' }]);

    expect(runner.query).toHaveBeenCalledWith(
      'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date',
      ['ORDER_001']
    );
  });

  test('修改订单基础信息时，应当只更新 service 白名单字段', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rows: [{ order_id: 'ORDER_001', guest_name: '李四' }] }) };

    await expect(orderManageRepository.updateOrderFields(runner, 'ORDER_001', {
      guest_name: '李四',
      payment_method: '微信'
    })).resolves.toEqual([{ order_id: 'ORDER_001', guest_name: '李四' }]);

    expect(runner.query.mock.calls[0][0]).toContain('SET guest_name = $1, payment_method = $2');
    expect(runner.query.mock.calls[0][1]).toEqual(['李四', '微信', 'ORDER_001']);
  });

  test('修改订单支付方式时，应当同步房费账单收款方式', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rowCount: 2 }) };

    await expect(orderManageRepository.updateRoomFeeBillsPaymentMethod(runner, 'ORDER_001', '微信'))
      .resolves.toEqual({ rowCount: 2 });

    expect(runner.query.mock.calls[0][1]).toEqual(['微信', 'ORDER_001']);
  });

  test('办理正常退房时，应当在事务连接里更新订单状态', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rows: [{ order_id: 'ORDER_001', status: 'checked-out' }] }) };

    await expect(orderManageRepository.updateOrderStatusInTransaction(runner, 'ORDER_001', 'checked-out'))
      .resolves.toEqual({ order_id: 'ORDER_001', status: 'checked-out' });

    expect(runner.query).toHaveBeenCalledWith(
      'UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *',
      ['checked-out', 'ORDER_001']
    );
  });

  test('办理正常退房时，应当按住宿日期读取订单日记录', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rows: [{ order_id: 'ORDER_001', room_number: '101' }] }) };

    await expect(orderManageRepository.findOrderRowsForCheckout(runner, 'ORDER_001'))
      .resolves.toEqual([{ order_id: 'ORDER_001', room_number: '101' }]);

    expect(runner.query).toHaveBeenCalledWith(
      'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date',
      ['ORDER_001']
    );
  });

  test('办理正常退房时，应当把涉及房间改成清洁中', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };

    await expect(orderManageRepository.markRoomCleaning(runner, '101')).resolves.toEqual({ rowCount: 1 });

    expect(runner.query).toHaveBeenCalledWith(
      'UPDATE rooms SET status = $1 WHERE room_number = $2',
      ['cleaning', '101']
    );
  });

  test('办理提前退房时，应当锁定同一订单的所有日记录', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rows: [{ order_id: 'ORDER_001' }] }) };

    await expect(orderManageRepository.findOrderRowsForEarlyCheckout(runner, 'ORDER_001'))
      .resolves.toEqual([{ order_id: 'ORDER_001' }]);

    expect(runner.query).toHaveBeenCalledWith(
      'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date FOR UPDATE',
      ['ORDER_001']
    );
  });

  test('未入住退房时，应当取消订单并清零房费', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };

    await expect(orderManageRepository.cancelOrderAfterCheckin(runner, 'ORDER_001', '2026-01-10'))
      .resolves.toEqual({ rowCount: 1 });

    expect(runner.query.mock.calls[0][1]).toEqual(['2026-01-10', 'ORDER_001']);
  });

  test('已入住提前退房时，应当删除实际退房日及之后的订单日记录', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rowCount: 2 }) };

    await expect(orderManageRepository.deleteUnstayedOrderRows(runner, 'ORDER_001', '2026-01-11'))
      .resolves.toEqual({ rowCount: 2 });

    expect(runner.query.mock.calls[0][1]).toEqual(['ORDER_001', '2026-01-11']);
  });

  test('提前退房退款时，应当按业务分支写入负数账单', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rows: [{ bill_id: 1, change_price: '-120.00' }] }) };

    await expect(orderManageRepository.insertEarlyCheckoutRefundBill(runner, {
      orderNumber: 'ORDER_001',
      roomNumber: '101',
      guestName: '张三',
      amount: -120,
      changeType: '房费',
      payWay: '微信',
      remarks: '提前退房',
      stayType: '客房',
      stayDate: '2026-01-11'
    })).resolves.toEqual({ bill_id: 1, change_price: '-120.00' });

    expect(runner.query.mock.calls[0][1]).toEqual([
      'ORDER_001',
      '101',
      '张三',
      -120,
      '房费',
      '微信',
      '提前退房',
      '客房',
      '2026-01-11'
    ]);
  });

  test('每日换房时，应当查询指定日期的订单日记录', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rows: [{ order_id: 'ORDER_001' }] }) };

    await expect(orderManageRepository.findOrderRowForDayRoomChange(runner, 'ORDER_001', '2025-11-30'))
      .resolves.toEqual({ order_id: 'ORDER_001' });

    expect(runner.query).toHaveBeenCalledWith(
      'SELECT * FROM orders WHERE order_id = $1 AND stay_date = $2',
      ['ORDER_001', '2025-11-30']
    );
  });

  test('每日换房时，应当排除已取消和已退房订单后检查房间占用', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rows: [{ order_id: 'ORDER_002', guest_name: '李四' }] }) };

    await expect(orderManageRepository.findActiveRoomConflict(runner, '101', '2025-11-30', 'ORDER_001'))
      .resolves.toEqual({ order_id: 'ORDER_002', guest_name: '李四' });

    expect(runner.query.mock.calls[0][1]).toEqual(['101', '2025-11-30', 'ORDER_001']);
  });

  test('每日换房时，应当按新房间房型更新订单日记录', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rows: [{ order_id: 'ORDER_001', room_number: '101' }] }) };

    await expect(orderManageRepository.updateOrderDayRoom(
      runner,
      'ORDER_001',
      '2025-11-30',
      '101',
      'room_type_a'
    )).resolves.toEqual({ order_id: 'ORDER_001', room_number: '101' });

    expect(runner.query.mock.calls[0][1]).toEqual(['101', 'room_type_a', 'ORDER_001', '2025-11-30']);
  });

  test('每日换房时，应当同步目标日期房费账单的房间号', async () => {
    const runner = { query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ bill_id: 1 }] }) };

    await expect(orderManageRepository.updateRoomFeeBillRoomNumber(
      runner,
      'ORDER_001',
      '2025-11-30',
      '101'
    )).resolves.toEqual({ rowCount: 1, rows: [{ bill_id: 1 }] });

    expect(runner.query.mock.calls[0][1]).toEqual(['101', 'ORDER_001', '2025-11-30']);
  });

  test('读取押金状态时，应当按订单押金、退押账单和总房费返回统计结果', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ deposit: '30.00' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ change_refunded: '12.00' }] })
      .mockResolvedValueOnce({
        rows: [
          { amount: '12.00', pay_way: '微信', time: '2025-12-05 10:00:00' }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ total_room_fee: '500.00' }] });

    await expect(orderManageRepository.getDepositInfo('ORDER_001')).resolves.toEqual({
      orderId: 'ORDER_001',
      deposit: 30,
      refunded: 12,
      remaining: 18,
      refundRecords: [
        { amount: 12, method: '微信', time: '2025-12-05 10:00:00' }
      ],
      totalRoomFee: 500
    });
  });

  test('读取押金状态时，orders.deposit 为 0 应当兼容历史 bills.deposit 字段', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ deposit: '0.00' }] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ deposit: '20.00' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ change_refunded: '0.00' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total_room_fee: '100.00' }] });

    await expect(orderManageRepository.getDepositInfo('ORDER_OLD')).resolves.toMatchObject({
      orderId: 'ORDER_OLD',
      deposit: 20,
      refunded: 0,
      remaining: 20,
      totalRoomFee: 100
    });
  });
});
