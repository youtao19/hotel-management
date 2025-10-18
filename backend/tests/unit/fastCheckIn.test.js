/**
 * createCheckedInOrderWithTransaction 单元测试
 *
 * 覆盖内容：
 * 1. 正常流程：成功创建订单、账单并更新房间状态
 * 2. 业务冲突：同一房间已存在重叠订单时返回冲突错误
 */

const orderModule = require('../../modules/orderModule');
const { query } = require('../../database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('../test-helpers');

describe('orderModule.createCheckedInOrderWithTransaction', () => {
  beforeEach(async () => {
    await global.cleanupTestData();
  });

  it('应成功创建已入住订单、账单并更新房间状态', async () => {
    const suffix = Date.now().toString();
    const roomType = await createTestRoomType({ type_code: `FC_UNIT_${suffix}` });
    const room = await createTestRoom(roomType.type_code, { room_number: `FC_UNIT_${suffix}` });

    const orderId = `FAST_UNIT_${suffix}`;
    const payload = {
      order_id: orderId,
      guest_name: `单测客人_${suffix}`,
      id_number: '123456789012345678',
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-10-10',
      check_out_date: '2025-10-11',
      payment_method: 'cash',
      total_price: 388,
      deposit: 200,
      phone: '13800138000',
      order_source: 'front_desk'
    };

    const result = await orderModule.createCheckedInOrderWithTransaction(payload, payload.deposit);

    expect(result.success).toBe(true);
    expect(result.order.order_id).toBe(orderId);
    expect(result.order.status).toBe('checked-in');
    expect(result.bills).toHaveLength(2);
    expect(result.room.status).toBe('occupied');

    const { rows: [orderRow] } = await query(
      'SELECT status, stay_type, deposit, total_price FROM orders WHERE order_id = $1',
      [orderId]
    );
    expect(orderRow).toBeDefined();
    expect(orderRow.status).toBe('checked-in');
    expect(orderRow.stay_type).toBe('客房');
    expect(Number(orderRow.deposit)).toBeCloseTo(200, 2);
    expect(Number(orderRow.total_price)).toBeCloseTo(388, 5);

    const { rows: bills } = await query(
      'SELECT change_type, change_price FROM bills WHERE order_id = $1',
      [orderId]
    );
    expect(bills).toHaveLength(2);
    expect(bills.map(b => b.change_type))
      .toEqual(expect.arrayContaining(['房费', '收押']));

    const { rows: [roomRow] } = await query(
      'SELECT status FROM rooms WHERE room_number = $1',
      [room.room_number]
    );
    expect(roomRow).toBeDefined();
    expect(roomRow.status).toBe('occupied');
  });

  it('当房间在同一时段已被预订时应抛出 ROOM_ALREADY_BOOKED 错误', async () => {
    const suffix = `${Date.now()}_conflict`;
    const roomType = await createTestRoomType({ type_code: `FC_CONFLICT_${suffix}` });
    const room = await createTestRoom(roomType.type_code, { room_number: `FC_CONFLICT_${suffix}` });

    await createTestOrder({
      order_id: `EXISTING_${suffix}`,
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-10-10',
      check_out_date: '2025-10-12',
      status: 'pending',
      total_price: 500,
      payment_method: 'cash',
    }, { insert: true });

    const payload = {
      order_id: `FAST_CONFLICT_${suffix}`,
      guest_name: `冲突客人_${suffix}`,
      id_number: '123456789012345678',
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-10-11',
      check_out_date: '2025-10-12',
      payment_method: 'cash',
      total_price: 288,
      deposit: 100,
      phone: '13800138000',
      order_source: 'front_desk'
    };

    await expect(
      orderModule.createCheckedInOrderWithTransaction(payload, payload.deposit)
    ).rejects.toEqual(expect.objectContaining({
      code: 'ROOM_ALREADY_BOOKED',
      statusCode: 409
    }));

    const { rows: [{ count }] } = await query(
      'SELECT COUNT(*)::int FROM orders WHERE order_id = $1',
      [payload.order_id]
    );
    expect(count).toBe(0);
  });
});

