jest.mock('../../billModule', () => ({
  addBill: jest.fn()
}));

jest.mock('../orderManage.repository', () => ({
  cancelOrderAfterCheckin: jest.fn(),
  countRoomFeeBillPaymentWays: jest.fn(),
  deleteBillsByIds: jest.fn(),
  deleteUnstayedOrderRows: jest.fn(),
  findBillsForSplitUpdate: jest.fn(),
  findActiveRoomConflict: jest.fn(),
  findOrderRowsForCheckout: jest.fn(),
  findOrderRowsForEarlyCheckout: jest.fn(),
  findOrderRowsForUpdate: jest.fn(),
  findOrderRowsForUpdateWithBills: jest.fn(),
  findOrderRowsInTransaction: jest.fn(),
  findRoomByNumber: jest.fn(),
  getOrderBillNetPaid: jest.fn(),
  getDepositInfo: jest.fn(),
  findOrderRowsByOrderId: jest.fn(),
  findOrderRowForDayRoomChange: jest.fn(),
  getClient: jest.fn(),
  insertBillInTransaction: jest.fn(),
  insertEarlyCheckoutRefundBill: jest.fn(),
  insertDayRoomChangeLog: jest.fn(),
  insertOrderChangeLog: jest.fn(),
  listDailyOrders: jest.fn(),
  listOrders: jest.fn(),
  markRoomAvailable: jest.fn(),
  markRoomCleaning: jest.fn(),
  updateAllBillRoomNumbers: jest.fn(),
  updateDailyRoomPrice: jest.fn(),
  updateOrderEarlyCheckout: jest.fn(),
  updateOrderFields: jest.fn(),
  updateOrderDayRoom: jest.fn(),
  updateOrderPaymentMethodInTransaction: jest.fn(),
  updateRoomFeeBillsPaymentMethod: jest.fn(),
  updateRoomFeeBillRoomNumber: jest.fn(),
  updateSplitBill: jest.fn(),
  updateOrderStatus: jest.fn(),
  updateOrderStatusInTransaction: jest.fn()
}));

const billModule = require('../../billModule');
const orderManageRepository = require('../orderManage.repository');
const orderManageService = require('../orderManage.service');

describe('订单管理业务服务', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('查询订单列表时，应当通过 repository 读取聚合订单数据', async () => {
    const filters = { search: '张三', status: 'pending', date: '2025-11-30' };
    orderManageRepository.listOrders.mockResolvedValue([{ order_id: 'ORDER_001' }]);

    await expect(orderManageService.listOrders(filters)).resolves.toEqual([{ order_id: 'ORDER_001' }]);

    expect(orderManageRepository.listOrders).toHaveBeenCalledWith(filters);  });

  test('查询每日订单明细时，应当通过 repository 保持按天返回', async () => {
    orderManageRepository.listDailyOrders.mockResolvedValue([{ order_id: 'ORDER_001', stay_date: '2025-11-30' }]);

    await expect(orderManageService.listDailyOrders())
      .resolves.toEqual([{ order_id: 'ORDER_001', stay_date: '2025-11-30' }]);

    expect(orderManageRepository.listDailyOrders).toHaveBeenCalledWith();  });

  test('查询订单详情时，应当通过 repository 返回同一订单的所有日记录', async () => {
    orderManageRepository.findOrderRowsByOrderId.mockResolvedValue([{ order_id: 'ORDER_001' }]);

    await expect(orderManageService.getOrder('ORDER_001')).resolves.toEqual([{ order_id: 'ORDER_001' }]);

    expect(orderManageRepository.findOrderRowsByOrderId).toHaveBeenCalledWith('ORDER_001');  });

  test('修改订单状态时，应当通过 repository 更新同一订单号下的日记录', async () => {
    orderManageRepository.updateOrderStatus.mockResolvedValue({ order_id: 'ORDER_001', status: 'checked-in' });

    await expect(orderManageService.updateOrderStatus('ORDER_001', 'checked-in'))
      .resolves.toEqual({ order_id: 'ORDER_001', status: 'checked-in' });

    expect(orderManageRepository.updateOrderStatus).toHaveBeenCalledWith('ORDER_001', 'checked-in');  });

  test('每日换房时，应当在同一个事务里更新订单和账单房间号', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    orderManageRepository.getClient.mockResolvedValue(client);
    orderManageRepository.findOrderRowForDayRoomChange.mockResolvedValue({ order_id: 'ORDER_001', room_number: '100' });
    orderManageRepository.findActiveRoomConflict.mockResolvedValue(null);
    orderManageRepository.findRoomByNumber.mockResolvedValue({ room_number: '101', type_code: 'room_type_a' });
    orderManageRepository.updateOrderDayRoom.mockResolvedValue({ order_id: 'ORDER_001', room_number: '101' });
    orderManageRepository.updateRoomFeeBillRoomNumber.mockResolvedValue({ rowCount: 1 });
    orderManageRepository.insertDayRoomChangeLog.mockResolvedValue({});

    await expect(orderManageService.updateOrderDayRoom(
      'ORDER_001',
      '2025-11-30',
      '101',
      { username: 'alice' }
    )).resolves.toEqual({ order_id: 'ORDER_001', room_number: '101' });

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(orderManageRepository.findOrderRowForDayRoomChange)
      .toHaveBeenCalledWith(client, 'ORDER_001', '2025-11-30');
    expect(orderManageRepository.updateOrderDayRoom)
      .toHaveBeenCalledWith(client, 'ORDER_001', '2025-11-30', '101', 'room_type_a');
    expect(orderManageRepository.insertDayRoomChangeLog)
      .toHaveBeenCalledWith('ORDER_001', 'alice', '100', '101', '2025-11-30');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();  });

  test('每日换房找不到指定日期订单时，应当回滚事务', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    orderManageRepository.getClient.mockResolvedValue(client);
    orderManageRepository.findOrderRowForDayRoomChange.mockResolvedValue(null);

    await expect(orderManageService.updateOrderDayRoom(
      'ORDER_MISSING',
      '2025-11-30',
      '101',
      { username: 'alice' }
    )).rejects.toThrow('订单 ORDER_MISSING 在 2025-11-30 没有记录');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
    expect(orderManageRepository.updateOrderDayRoom).not.toHaveBeenCalled();
  });

  test('修改订单基础信息时，应当更新所有日记录并记录变更', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    orderManageRepository.getClient.mockResolvedValue(client);
    orderManageRepository.findOrderRowsForUpdate.mockResolvedValue([
      {
        order_id: 'ORDER_001',
        guest_name: '张三',
        phone: '123',
        payment_method: '现金',
        stay_type: '客房',
        check_in_date: '2026-01-10',
        check_out_date: '2026-01-12'
      },
      {
        order_id: 'ORDER_001',
        guest_name: '张三',
        phone: '123',
        payment_method: '现金',
        stay_type: '客房',
        check_in_date: '2026-01-10',
        check_out_date: '2026-01-12'
      }
    ]);
    orderManageRepository.updateOrderFields.mockResolvedValue([{ order_id: 'ORDER_001', guest_name: '李四' }]);
    orderManageRepository.updateRoomFeeBillsPaymentMethod.mockResolvedValue({ rowCount: 2 });
    orderManageRepository.insertOrderChangeLog.mockResolvedValue({});
    orderManageRepository.findOrderRowsByOrderId.mockResolvedValue([{ order_id: 'ORDER_001', guest_name: '李四' }]);

    await expect(orderManageService.updateOrder('ORDER_001', {
      guest_name: '李四',
      payment_method: '微信',
      reason: '前台修正客人信息'
    }, 'alice')).resolves.toEqual([{ order_id: 'ORDER_001', guest_name: '李四' }]);

    expect(orderManageRepository.updateOrderFields).toHaveBeenCalledWith(client, 'ORDER_001', {
      guest_name: '李四',
      payment_method: '微信'
    });
    expect(orderManageRepository.updateRoomFeeBillsPaymentMethod)
      .toHaveBeenCalledWith(client, 'ORDER_001', '微信');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(orderManageRepository.insertOrderChangeLog).toHaveBeenCalledWith(
      'ORDER_001',
      'alice',
      expect.objectContaining({
        guest_name: { old: '张三', new: '李四' },
        payment_method: { old: '现金', new: '微信' }
      }),
      '前台修正客人信息'
    );
    expect(client.release).toHaveBeenCalled();  });

  test('修改订单没有可更新字段时，应当回滚并返回提示', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    orderManageRepository.getClient.mockResolvedValue(client);
    orderManageRepository.findOrderRowsForUpdate.mockResolvedValue([
      {
        order_id: 'ORDER_001',
        stay_type: '客房',
        check_in_date: '2026-01-10',
        check_out_date: '2026-01-12'
      }
    ]);

    await expect(orderManageService.updateOrder('ORDER_001', { reason: '没有实际字段' }))
      .resolves.toEqual({ message: '没有字段需要更新' });

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(orderManageRepository.updateOrderFields).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });

  test('联合修改订单和账单时，应当在同一个事务里同步房费和押金拆分', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    const body = {
      orderData: { payment_method: '现金', deposit: 50 },
      roomPrice: { '2025-11-30': 100, '2025-12-01': 100 },
      changedBy: 'bob',
      roomFeePaymentSplits: [{ method: '现金', amount: 120 }, { method: '微信', amount: 80 }],
      depositPaymentSplits: [{ method: '微信', amount: 50 }],
      depositPaymentMethod: '微信'
    };
    const latestRows = [
      {
        order_id: 'ORDER_001',
        stay_date: '2025-11-30',
        check_in_date: '2025-11-30',
        room_number: '101',
        guest_name: '张三',
        stay_type: '客房',
        payment_method: '现金',
        deposit: 50,
        total_price: 100
      },
      {
        order_id: 'ORDER_001',
        stay_date: '2025-12-01',
        check_in_date: '2025-11-30',
        room_number: '101',
        guest_name: '张三',
        stay_type: '客房',
        payment_method: '现金',
        deposit: 50,
        total_price: 100
      }
    ];
    orderManageRepository.getClient.mockResolvedValue(client);
    orderManageRepository.findOrderRowsForUpdateWithBills.mockResolvedValue(latestRows);
    orderManageRepository.updateDailyRoomPrice
      .mockResolvedValueOnce({ orderUpdated: 1, billUpdated: 1 })
      .mockResolvedValueOnce({ orderUpdated: 1, billUpdated: 1 });
    orderManageRepository.findOrderRowsInTransaction.mockResolvedValue(latestRows);
    orderManageRepository.findBillsForSplitUpdate
      .mockResolvedValueOnce([{ bill_id: 1 }])
      .mockResolvedValueOnce([{ bill_id: 2 }])
      .mockResolvedValueOnce([{ bill_id: 3 }]);
    orderManageRepository.findOrderRowsByOrderId.mockResolvedValue([{ order_id: 'ORDER_001', payment_method: '混合支付' }]);
    orderManageRepository.insertOrderChangeLog.mockResolvedValue({});

    await expect(orderManageService.updateOrderWithBills('ORDER_001', body)).resolves.toMatchObject({
      success: true,
      order: [{ order_id: 'ORDER_001', payment_method: '混合支付' }],
      message: '订单和账单更新成功'
    });

    expect(orderManageRepository.updateOrderFields).toHaveBeenCalledWith(client, 'ORDER_001', {
      payment_method: '现金',
      deposit: 50
    });
    expect(orderManageRepository.updateDailyRoomPrice)
      .toHaveBeenCalledWith(client, 'ORDER_001', '2025-11-30', 100);
    expect(orderManageRepository.updateOrderPaymentMethodInTransaction)
      .toHaveBeenCalledWith(client, 'ORDER_001', '混合支付');
    expect(orderManageRepository.updateSplitBill).toHaveBeenCalledTimes(3);
    expect(orderManageRepository.insertOrderChangeLog)
      .toHaveBeenCalledWith('ORDER_001', 'bob', expect.objectContaining({
        action: 'update_order_with_bills'
      }), '订单信息更新（含房费/账单同步）');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();  });

  test('提前退房时，应当用 operator 覆盖登录用户作为 changedBy', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    const body = {
      actualCheckoutTime: '2026-01-11T09:00',
      refundAmount: 120,
      refundMethod: '现金',
      operator: 'front-desk',
      remarks: '提前离店',
      hasStayed: true
    };
    orderManageRepository.getClient.mockResolvedValue(client);
    orderManageRepository.findOrderRowsForEarlyCheckout.mockResolvedValue([
      {
        order_id: 'ORDER_001',
        room_number: '101',
        guest_name: '张三',
        check_in_date: '2026-01-10',
        check_out_date: '2026-01-13',
        stay_date: '2026-01-10',
        status: 'checked-in',
        payment_method: '微信',
        stay_type: '客房',
        total_price: 100
      },
      {
        order_id: 'ORDER_001',
        room_number: '101',
        guest_name: '张三',
        check_in_date: '2026-01-10',
        check_out_date: '2026-01-13',
        stay_date: '2026-01-11',
        status: 'checked-in',
        payment_method: '微信',
        stay_type: '客房',
        total_price: 120
      },
      {
        order_id: 'ORDER_001',
        room_number: '101',
        guest_name: '张三',
        check_in_date: '2026-01-10',
        check_out_date: '2026-01-13',
        stay_date: '2026-01-12',
        status: 'checked-in',
        payment_method: '微信',
        stay_type: '客房',
        total_price: 130
      }
    ]);
    orderManageRepository.insertEarlyCheckoutRefundBill.mockResolvedValue({ bill_id: 1 });
    orderManageRepository.findOrderRowsByOrderId.mockResolvedValue([{ order_id: 'ORDER_001', status: 'checked-out' }]);

    await expect(orderManageService.earlyCheckout('ORDER_001', body, { username: 'alice' }))
      .resolves.toMatchObject({
        success: true,
        refund: {
          recommended: 250,
          actual: 120,
          method: '现金',
          bill: { bill_id: 1 }
        },
        refundedStayDates: ['2026-01-11', '2026-01-12']
      });

    expect(orderManageRepository.updateOrderEarlyCheckout)
      .toHaveBeenCalledWith(client, 'ORDER_001', '2026-01-11');
    expect(orderManageRepository.deleteUnstayedOrderRows)
      .toHaveBeenCalledWith(client, 'ORDER_001', '2026-01-11');
    expect(orderManageRepository.insertEarlyCheckoutRefundBill).toHaveBeenCalledWith(client, expect.objectContaining({
      orderNumber: 'ORDER_001',
      amount: -120,
      changeType: '房费',
      payWay: '现金',
      stayDate: '2026-01-11'
    }));
    expect(orderManageRepository.markRoomCleaning).toHaveBeenCalledWith(client, '101');
    expect(orderManageRepository.insertOrderChangeLog)
      .toHaveBeenCalledWith('ORDER_001', 'front-desk', expect.objectContaining({
        action: 'early_checkout',
        actual_refund: 120
      }), '提前离店');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();  });

  test('读取押金状态时，应当通过 repository 使用账单统计口径', async () => {
    orderManageRepository.getDepositInfo.mockResolvedValue({
      orderId: 'ORDER_001',
      deposit: 30,
      refunded: 12,
      remaining: 18
    });

    await expect(orderManageService.getDepositInfo('ORDER_001')).resolves.toEqual({
      orderId: 'ORDER_001',
      deposit: 30,
      refunded: 12,
      remaining: 18
    });

    expect(orderManageRepository.getDepositInfo).toHaveBeenCalledWith('ORDER_001');  });

  test('未入住退房时，应当取消订单并把房间恢复为空闲', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    orderManageRepository.getClient.mockResolvedValue(client);
    orderManageRepository.findOrderRowsForEarlyCheckout.mockResolvedValue([
      {
        order_id: 'ORDER_001',
        room_number: '101',
        guest_name: '张三',
        check_in_date: '2026-01-10',
        check_out_date: '2026-01-12',
        stay_date: '2026-01-10',
        status: 'checked-in',
        payment_method: '微信',
        stay_type: '客房',
        total_price: 100,
        deposit: 0
      }
    ]);
    orderManageRepository.insertEarlyCheckoutRefundBill.mockResolvedValue({ bill_id: 2 });
    orderManageRepository.findOrderRowsByOrderId.mockResolvedValue([{ order_id: 'ORDER_001', status: 'cancelled' }]);

    await expect(orderManageService.earlyCheckout('ORDER_001', {
      actualCheckoutTime: '2026-01-10T09:00',
      refundAmount: '80.00',
      refundMethod: '微信',
      hasStayed: false
    }, { username: 'alice' })).resolves.toMatchObject({
      success: true,
      cancelled: true,
      refund: {
        actual: 80,
        method: '微信',
        bill: { bill_id: 2 }
      },
      refundedStayDates: []
    });

    expect(orderManageRepository.cancelOrderAfterCheckin)
      .toHaveBeenCalledWith(client, 'ORDER_001', '2026-01-10');
    expect(orderManageRepository.insertEarlyCheckoutRefundBill).toHaveBeenCalledWith(client, expect.objectContaining({
      changeType: '退款',
      amount: -80
    }));
    expect(orderManageRepository.markRoomAvailable).toHaveBeenCalledWith(client, '101');
    expect(orderManageRepository.insertOrderChangeLog)
      .toHaveBeenCalledWith('ORDER_001', 'alice', expect.objectContaining({
        action: 'cancel_after_checkin',
        new_status: 'cancelled'
      }), '未入住退房办理');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('办理退押金时，应当读取订单后创建退押账单', async () => {
    orderManageRepository.findOrderRowsByOrderId.mockResolvedValue([
      {
        order_id: 'ORDER_001',
        room_number: '101',
        guest_name: '张三',
        deposit: 30,
        status: 'checked-out',
        stay_type: '客房',
        check_out_date: '2025-12-05'
      }
    ]);
    billModule.addBill.mockResolvedValue({ bill_id: 1, change_type: '退押', change_price: -12 });

    await expect(orderManageService.refundDeposit({
      order_id: 'ORDER_001',
      change_price: 12,
      pay_way: '微信',
      notes: '部分退押'
    })).resolves.toEqual({ bill_id: 1, change_type: '退押', change_price: -12 });

    expect(orderManageRepository.findOrderRowsByOrderId).toHaveBeenCalledWith('ORDER_001');
    expect(billModule.addBill).toHaveBeenCalledWith(expect.objectContaining({
      order_id: 'ORDER_001',
      change_price: -12,
      change_type: '退押',
      room_number: '101',
      guest_name: '张三',
      stay_type: '客房',
      stay_date: '2025-12-05'
    }));  });

  test('办理退押金时，订单未退房或取消应当拒绝', async () => {
    orderManageRepository.findOrderRowsByOrderId.mockResolvedValue([
      { order_id: 'ORDER_001', deposit: 30, status: 'checked-in' }
    ]);

    await expect(orderManageService.refundDeposit({
      order_id: 'ORDER_001',
      change_price: 12
    })).rejects.toThrow('只有已退房或已取消的订单才能退押金');

    expect(billModule.addBill).not.toHaveBeenCalled();
  });

  test('办理正常退房时，应当在同一个事务里更新订单状态和房态', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    orderManageRepository.getClient.mockResolvedValue(client);
    orderManageRepository.updateOrderStatusInTransaction.mockResolvedValue({ order_id: 'ORDER_001', status: 'checked-out' });
    orderManageRepository.findOrderRowsForCheckout.mockResolvedValue([
      { order_id: 'ORDER_001', room_number: '101' },
      { order_id: 'ORDER_001', room_number: '101' }
    ]);
    orderManageRepository.markRoomCleaning.mockResolvedValue({ rowCount: 1 });
    orderManageRepository.findOrderRowsByOrderId.mockResolvedValue([{ order_id: 'ORDER_001', status: 'checked-out' }]);

    await expect(orderManageService.checkOut('ORDER_001')).resolves.toEqual([
      { order_id: 'ORDER_001', status: 'checked-out' }
    ]);

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(orderManageRepository.updateOrderStatusInTransaction)
      .toHaveBeenCalledWith(client, 'ORDER_001', 'checked-out');
    expect(orderManageRepository.findOrderRowsForCheckout).toHaveBeenCalledWith(client, 'ORDER_001');
    expect(orderManageRepository.markRoomCleaning).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();  });

  test('办理正常退房失败时，应当回滚事务并释放连接', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    orderManageRepository.getClient.mockResolvedValue(client);
    orderManageRepository.updateOrderStatusInTransaction.mockRejectedValue(new Error('数据库更新失败'));

    await expect(orderManageService.checkOut('ORDER_001')).rejects.toThrow('数据库更新失败');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
    expect(orderManageRepository.markRoomCleaning).not.toHaveBeenCalled();
  });
});
