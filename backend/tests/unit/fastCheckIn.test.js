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
      check_out_date: '2025-10-11', // 1晚
      payment_method: 'cash',
      total_price: 388,
      deposit: 200,
      phone: '13800138000',
      order_source: 'front_desk'
    };

    const result = await orderModule.createCheckedInOrderWithTransaction(payload, payload.deposit);

    // 验证返回的订单信息
    expect(result.order).toBeDefined();
    expect(result.order.order_id).toBe(orderId);
    expect(result.order.status).toBe('checked-in');

    // 验证返回的账单信息（1晚 = 1条房费 + 1条押金）
    expect(result.bills).toBeDefined();
    expect(result.bills).toHaveLength(2);

    const roomFeeBills = result.bills.filter(b => b.change_type === '房费');
    const depositBills = result.bills.filter(b => b.change_type === '收押');
    expect(roomFeeBills).toHaveLength(1);
    expect(depositBills).toHaveLength(1);
    expect(Number(roomFeeBills[0].change_price)).toBeCloseTo(388, 2);
    expect(Number(depositBills[0].change_price)).toBeCloseTo(200, 2);

    // 验证数据库中的订单
    const { rows: [orderRow] } = await query(
      'SELECT status, stay_type, deposit, total_price FROM orders WHERE order_id = $1',
      [orderId]
    );
    expect(orderRow).toBeDefined();
    expect(orderRow.status).toBe('checked-in');
    expect(orderRow.stay_type).toBe('客房');
    expect(Number(orderRow.deposit)).toBeCloseTo(200, 2);
    expect(Number(orderRow.total_price)).toBeCloseTo(388, 5);

    // 验证数据库中的账单
    const { rows: bills } = await query(
      'SELECT change_type, change_price, stay_date FROM bills WHERE order_id = $1 ORDER BY stay_date',
      [orderId]
    );
    expect(bills).toHaveLength(2);
    expect(bills.map(b => b.change_type))
      .toEqual(expect.arrayContaining(['房费', '收押']));

    // 验证房间状态已更新
    const { rows: [roomRow] } = await query(
      'SELECT status FROM rooms WHERE room_number = $1',
      [room.room_number]
    );
    expect(roomRow).toBeDefined();
    expect(roomRow.status).toBe('occupied');
  });

  it('应正确创建多晚住宿的每日账单', async () => {
    const suffix = `${Date.now()}_multi`;
    const roomType = await createTestRoomType({ type_code: `FC_MULTI_${suffix}` });
    const room = await createTestRoom(roomType.type_code, { room_number: `FC_MULTI_${suffix}` });

    const orderId = `FAST_MULTI_${suffix}`;
    const payload = {
      order_id: orderId,
      guest_name: `多晚客人_${suffix}`,
      id_number: '123456789012345678',
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-10-10',
      check_out_date: '2025-10-13', // 3晚
      payment_method: 'wechat',
      total_price: 900,
      deposit: 300,
      phone: '13800138000',
      order_source: 'front_desk'
    };

    const result = await orderModule.createCheckedInOrderWithTransaction(payload, payload.deposit);

    // 验证账单数量（3晚 = 3条房费 + 1条押金）
    expect(result.bills).toHaveLength(4);

    const roomFeeBills = result.bills.filter(b => b.change_type === '房费');
    const depositBills = result.bills.filter(b => b.change_type === '收押');

    expect(roomFeeBills).toHaveLength(3);
    expect(depositBills).toHaveLength(1);

    // 验证每日房费均分
    roomFeeBills.forEach(bill => {
      expect(Number(bill.change_price)).toBeCloseTo(300, 2); // 900 / 3 = 300
    });

    // 验证房费账单日期覆盖整个住宿区间
    const roomFeeDates = roomFeeBills.map(bill => {
      const date = bill.stay_date;
      if (typeof date === 'string') {
        return date.split('T')[0];
      } else if (date instanceof Date) {
        // Date 对象转为 YYYY-MM-DD 格式
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return date;
    }).sort();

    expect(roomFeeDates).toEqual(['2025-10-10', '2025-10-11', '2025-10-12']);

    // 验证押金账单日期为入住日期
    const depositDateRaw = depositBills[0].stay_date;
    let depositDate;
    if (typeof depositDateRaw === 'string') {
      depositDate = depositDateRaw.split('T')[0];
    } else if (depositDateRaw instanceof Date) {
      const year = depositDateRaw.getFullYear();
      const month = String(depositDateRaw.getMonth() + 1).padStart(2, '0');
      const day = String(depositDateRaw.getDate()).padStart(2, '0');
      depositDate = `${year}-${month}-${day}`;
    }

    expect(depositDate).toBe('2025-10-10');
  });

  it('应正确创建休息房订单和账单（同日入住退房，有押金）', async () => {
    const suffix = `${Date.now()}_rest`;
    const roomType = await createTestRoomType({ type_code: `FC_REST_${suffix}` });
    const room = await createTestRoom(roomType.type_code, { room_number: `FC_REST_${suffix}` });

    const orderId = `FAST_REST_${suffix}`;
    const payload = {
      order_id: orderId,
      guest_name: `休息房客人_${suffix}`,
      id_number: '123456789012345678',
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-10-15',
      check_out_date: '2025-10-15', // 同一天，休息房
      payment_method: 'cash',
      total_price: 200,
      deposit: 50,
      phone: '13800138000',
      order_source: 'front_desk'
    };

    const result = await orderModule.createCheckedInOrderWithTransaction(payload, payload.deposit);

    // 验证返回的订单信息
    expect(result.order).toBeDefined();
    expect(result.order.order_id).toBe(orderId);
    expect(result.order.status).toBe('checked-in');
    expect(result.order.stay_type).toBe('休息房'); // 验证住宿类型

    // 验证返回的账单信息（休息房 = 1条房费 + 1条押金）
    expect(result.bills).toBeDefined();
    expect(result.bills).toHaveLength(2);

    const roomFeeBills = result.bills.filter(b => b.change_type === '房费');
    const depositBills = result.bills.filter(b => b.change_type === '收押');
    expect(roomFeeBills).toHaveLength(1); // 休息房只有1条房费
    expect(depositBills).toHaveLength(1);
    expect(Number(roomFeeBills[0].change_price)).toBeCloseTo(200, 2);
    expect(Number(depositBills[0].change_price)).toBeCloseTo(50, 2);
    expect(roomFeeBills[0].stay_type).toBe('休息房');

    // 验证数据库中的订单
    const { rows: [orderRow] } = await query(
      'SELECT status, stay_type, deposit, total_price FROM orders WHERE order_id = $1',
      [orderId]
    );
    expect(orderRow).toBeDefined();
    expect(orderRow.status).toBe('checked-in');
    expect(orderRow.stay_type).toBe('休息房');
    expect(Number(orderRow.deposit)).toBeCloseTo(50, 2);
    expect(Number(orderRow.total_price)).toBeCloseTo(200, 5);

    // 验证数据库中的账单（1条房费 + 1条押金）
    const { rows: bills } = await query(
      'SELECT change_type, change_price, stay_type, stay_date FROM bills WHERE order_id = $1 ORDER BY stay_date',
      [orderId]
    );
    expect(bills).toHaveLength(2);
    expect(bills.map(b => b.change_type))
      .toEqual(expect.arrayContaining(['房费', '收押']));
    bills.forEach(bill => {
      expect(bill.stay_type).toBe('休息房');
    });

    // 验证房间状态已更新
    const { rows: [roomRow] } = await query(
      'SELECT status FROM rooms WHERE room_number = $1',
      [room.room_number]
    );
    expect(roomRow).toBeDefined();
    expect(roomRow.status).toBe('occupied');
  });

  it('应正确创建休息房订单和账单（同日入住退房，无押金）', async () => {
    const suffix = `${Date.now()}_rest_no_deposit`;
    const roomType = await createTestRoomType({ type_code: `FC_REST_ND_${suffix}` });
    const room = await createTestRoom(roomType.type_code, { room_number: `FC_REST_ND_${suffix}` });

    const orderId = `FAST_REST_ND_${suffix}`;
    const payload = {
      order_id: orderId,
      guest_name: `休息房客人_${suffix}`,
      id_number: '123456789012345678',
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-10-16',
      check_out_date: '2025-10-16', // 同一天，休息房
      payment_method: 'wechat',
      total_price: 180,
      deposit: 0, // 无押金
      phone: '13800138000',
      order_source: 'front_desk'
    };

    const result = await orderModule.createCheckedInOrderWithTransaction(payload, payload.deposit);

    // 验证返回的订单信息
    expect(result.order).toBeDefined();
    expect(result.order.order_id).toBe(orderId);
    expect(result.order.status).toBe('checked-in');
    expect(result.order.stay_type).toBe('休息房');

    // 验证返回的账单信息（休息房，无押金 = 1条房费）
    expect(result.bills).toBeDefined();
    expect(result.bills).toHaveLength(1);

    const roomFeeBills = result.bills.filter(b => b.change_type === '房费');
    const depositBills = result.bills.filter(b => b.change_type === '收押');
    expect(roomFeeBills).toHaveLength(1); // 休息房只有1条房费
    expect(depositBills).toHaveLength(0); // 无押金
    expect(Number(roomFeeBills[0].change_price)).toBeCloseTo(180, 2);
    expect(roomFeeBills[0].stay_type).toBe('休息房');

    // 验证数据库中的订单
    const { rows: [orderRow] } = await query(
      'SELECT status, stay_type, deposit, total_price FROM orders WHERE order_id = $1',
      [orderId]
    );
    expect(orderRow).toBeDefined();
    expect(orderRow.status).toBe('checked-in');
    expect(orderRow.stay_type).toBe('休息房');
    expect(Number(orderRow.deposit)).toBe(0);
    expect(Number(orderRow.total_price)).toBeCloseTo(180, 5);

    // 验证数据库中只有1条房费账单
    const { rows: bills } = await query(
      'SELECT change_type, change_price, stay_type FROM bills WHERE order_id = $1',
      [orderId]
    );
    expect(bills).toHaveLength(1);
    expect(bills[0].change_type).toBe('房费');
    expect(Number(bills[0].change_price)).toBeCloseTo(180, 2);
    expect(bills[0].stay_type).toBe('休息房');

    // 验证房间状态已更新
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

