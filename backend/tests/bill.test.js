const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { addRoomType, addRoom, createOrder } = require('./tools');

describe('账单金额调整接口', () => {
  const TEST_ROOM_TYPE = {
    type_code: 'BILL_ADJUST_TYPE',
    type_name: '账单调整测试房型',
    base_price: 120.00,
    description: '用于账单金额调整测试的房型',
    is_closed: false
  };

  const TEST_ROOM = {
    room_number: 'BILL_ADJUST_ROOM_01',
    type_code: TEST_ROOM_TYPE.type_code,
    status: 'available',
    price: 120.00,
    is_closed: false
  };

  const TEST_ORDER_ID = `BILL_ADJUST_${Date.now()}`;

  const baseOrderPayload = {
    order_id: TEST_ORDER_ID,
    id_source: 'web',
    order_source: '测试渠道',
    guest_name: '账单测试住客',
    room_type: TEST_ROOM_TYPE.type_code,
    room_number: TEST_ROOM.room_number,
    check_in_date: '2025-11-10',
    check_out_date: '2025-11-12',
    status: 'reserved',
    payment_method: '支付宝',
    phone: '13900001111',
    total_price: {
      '2025-11-10': 120.00,
      '2025-11-11': 120.00
    },
    deposit: 200.00,
    stay_type: '客房',
    create_time: '2025-10-30T09:00:00Z',
    remarks: '账单调整初始订单'
  };

  beforeAll(async () => {
    // 初始化测试房型和房间，并创建基础订单数据
    await query('DELETE FROM bills WHERE order_id = $1', [TEST_ORDER_ID]);
    await query('DELETE FROM orders WHERE order_id = $1', [TEST_ORDER_ID]);
    await query('DELETE FROM rooms WHERE room_number = $1', [TEST_ROOM.room_number]);
    await query('DELETE FROM room_types WHERE type_code = $1', [TEST_ROOM_TYPE.type_code]);

    await addRoomType([TEST_ROOM_TYPE]);
    await addRoom([TEST_ROOM]);

    const createResponse = await request(app)
      .post('/api/orders/new')
      .send(baseOrderPayload);

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.success).toBe(true);
  });

  afterAll(async () => {
    // 清理测试过程中产生的数据
    await query('DELETE FROM bills WHERE order_id = $1', [TEST_ORDER_ID]);
    await query('DELETE FROM orders WHERE order_id = $1', [TEST_ORDER_ID]);
    await query('DELETE FROM rooms WHERE room_number = $1', [TEST_ROOM.room_number]);
    await query('DELETE FROM room_types WHERE type_code = $1', [TEST_ROOM_TYPE.type_code]);
  });

  afterEach(async () => {
    // 确保每个用例之间账单数据隔离
    await query('DELETE FROM bills WHERE order_id = $1', [TEST_ORDER_ID]);
  });

  describe('POST /api/bills/add 金额调整', () => {
    test('补收使用正数金额，记录为收入并保留支付方式', async () => {
      const payload = {
        order_id: TEST_ORDER_ID,
        change_price: 88.88,
        change_type: '补收',
        method: '微信',
        notes: '补收测试'
      };

      const response = await request(app)
        .post('/api/bills/add')
        .send(payload);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);

      const stored = await query(
        'SELECT change_price, change_type, pay_way, remarks FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
        [TEST_ORDER_ID]
      );

      expect(stored.rows.length).toBe(1);
      expect(parseFloat(stored.rows[0].change_price)).toBeCloseTo(payload.change_price);
      expect(stored.rows[0].change_type).toBe(payload.change_type);
      expect(stored.rows[0].pay_way).toBe(payload.method);
      expect(stored.rows[0].remarks).toBe(payload.notes);
    });

    test('退款使用负数金额，系统记录为支出', async () => {
      const payload = {
        order_id: TEST_ORDER_ID,
        change_price: -45.5,
        change_type: '退款',
        method: '现金',
        notes: '退款测试 - 负值'
      };

      const response = await request(app)
        .post('/api/bills/add')
        .send(payload);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);

      const stored = await query(
        'SELECT change_price, change_type, pay_way, remarks FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
        [TEST_ORDER_ID]
      );

      expect(stored.rows.length).toBe(1);
      expect(parseFloat(stored.rows[0].change_price)).toBeCloseTo(payload.change_price);
      expect(Math.sign(parseFloat(stored.rows[0].change_price))).toBe(-1);
      expect(stored.rows[0].change_type).toBe(payload.change_type);
      expect(stored.rows[0].pay_way).toBe(payload.method);
      expect(stored.rows[0].remarks).toBe(payload.notes);
    });

    test('退款使用正数金额，系统会自动转换为负值', async () => {
      const payload = {
        order_id: TEST_ORDER_ID,
        change_price: 60,
        change_type: '退款',
        method: '平台',
        notes: '退款测试 - 正值'
      };

      const response = await request(app)
        .post('/api/bills/add')
        .send(payload);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);
      expect(Math.sign(parseFloat(response.body.data.change_price))).toBe(-1);

      const stored = await query(
        'SELECT change_price, change_type, pay_way, remarks FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
        [TEST_ORDER_ID]
      );

      expect(stored.rows.length).toBe(1);
      expect(parseFloat(stored.rows[0].change_price)).toBeCloseTo(-payload.change_price);
      expect(Math.sign(parseFloat(stored.rows[0].change_price))).toBe(-1);
      expect(stored.rows[0].change_type).toBe(payload.change_type);
      expect(stored.rows[0].pay_way).toBe(payload.method);
      expect(stored.rows[0].remarks).toBe(payload.notes);
    });

    test('不同支付方式被写入账单', async () => {
      const payload = {
        order_id: TEST_ORDER_ID,
        change_price: 10,
        change_type: '补收',
        method: '银行卡',
        notes: '支付方式测试'
      };

      const response = await request(app)
        .post('/api/bills/add')
        .send(payload);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);

      const stored = await query(
        'SELECT pay_way FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
        [TEST_ORDER_ID]
      );

      expect(stored.rows.length).toBe(1);
      expect(stored.rows[0].pay_way).toBe(payload.method);
    });

    test('补收使用负数金额时被强制转为正数', async () => {
      const payload = {
        order_id: TEST_ORDER_ID,
        change_price: -30,
        change_type: '补收',
        method: '微邮付',
        notes: '补收测试 - 负值'
      };

      const response = await request(app)
        .post('/api/bills/add')
        .send(payload);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);
      expect(Math.sign(parseFloat(response.body.data.change_price))).toBe(1);

      const stored = await query(
        'SELECT change_price FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
        [TEST_ORDER_ID]
      );

      expect(stored.rows.length).toBe(1);
      expect(parseFloat(stored.rows[0].change_price)).toBeCloseTo(Math.abs(payload.change_price));
      expect(Math.sign(parseFloat(stored.rows[0].change_price))).toBe(1);
    });

    test('退押正数金额也会保存为负值', async () => {
      const payload = {
        order_id: TEST_ORDER_ID,
        change_price: 80,
        change_type: '退押',
        method: '现金',
        notes: '退押测试 - 正值'
      };

      const response = await request(app)
        .post('/api/bills/add')
        .send(payload);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);
      expect(Math.sign(parseFloat(response.body.data.change_price))).toBe(-1);

      const stored = await query(
        'SELECT change_price FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
        [TEST_ORDER_ID]
      );

      expect(stored.rows.length).toBe(1);
      expect(parseFloat(stored.rows[0].change_price)).toBeCloseTo(-payload.change_price);
      expect(Math.sign(parseFloat(stored.rows[0].change_price))).toBe(-1);
    });
  });
});

describe('退押金接口', () => {
  const REFUND_ROOM_TYPE = {
    type_code: 'BILL_REFUND_TYPE',
    type_name: '退押金测试房型',
    base_price: 180.00,
    description: '用于退押金测试的房型',
    is_closed: false
  };

  const REFUND_ROOM = {
    room_number: 'BILL_REFUND_ROOM_01',
    type_code: REFUND_ROOM_TYPE.type_code,
    status: 'available',
    price: 180.00,
    is_closed: false
  };

  const REFUND_PREFIX = 'BILL_REFUND_';

  const buildCheckedOutOrder = ({ orderId, deposit = 200.0, overrides = {} }) => ({
    order_id: orderId,
    id_source: 'web',
    order_source: '退押金测试',
    guest_name: '退押金客人',
    room_type: REFUND_ROOM_TYPE.type_code,
    room_number: REFUND_ROOM.room_number,
    check_in_date: '2025-12-10',
    check_out_date: '2025-12-12',
    status: 'checked-out',
    payment_method: '支付宝',
    phone: '13955557777',
    total_price: 360.00,
    deposit,
    stay_type: '客房',
    create_time: '2025-12-08T08:00:00Z',
    remarks: '退押金测试订单',
    ...overrides
  });

  beforeAll(async () => {
    await query('DELETE FROM bills WHERE order_id LIKE $1', [`${REFUND_PREFIX}%`]);
    await query('DELETE FROM orders WHERE order_id LIKE $1', [`${REFUND_PREFIX}%`]);
    await query('DELETE FROM rooms WHERE room_number = $1', [REFUND_ROOM.room_number]);
    await query('DELETE FROM room_types WHERE type_code = $1', [REFUND_ROOM_TYPE.type_code]);

    await addRoomType([REFUND_ROOM_TYPE]);
    await addRoom([REFUND_ROOM]);
  });

  afterEach(async () => {
    await query('DELETE FROM bills WHERE order_id LIKE $1', [`${REFUND_PREFIX}%`]);
    await query('DELETE FROM orders WHERE order_id LIKE $1', [`${REFUND_PREFIX}%`]);
  });

  afterAll(async () => {
    await query('DELETE FROM bills WHERE order_id LIKE $1', [`${REFUND_PREFIX}%`]);
    await query('DELETE FROM orders WHERE order_id LIKE $1', [`${REFUND_PREFIX}%`]);
    await query('DELETE FROM rooms WHERE room_number = $1', [REFUND_ROOM.room_number]);
    await query('DELETE FROM room_types WHERE type_code = $1', [REFUND_ROOM_TYPE.type_code]);
  });

  test('部分退押金成功', async () => {
    const orderId = `${REFUND_PREFIX}PART_${Date.now()}`;
    await createOrder([buildCheckedOutOrder({ orderId, deposit: 300.0 })]);

    const payload = {
      order_id: orderId,
      change_price: 120,
      method: '微信',
      notes: '部分退押金',
      refundTime: '2025-12-12T12:00:00Z'
    };

    const response = await request(app)
      .post(`/api/orders/${orderId}/refund-deposit`)
      .send(payload);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('退押金处理成功');
    expect(response.body.order).toBeDefined();
    expect(response.body.order.change_type).toBe('退押');
    expect(Number(response.body.order.change_price)).toBeCloseTo(-payload.change_price, 5);

    const bills = await query(
      `SELECT change_price, change_type, pay_way FROM bills WHERE order_id = $1`,
      [orderId]
    );
    expect(bills.rows.length).toBe(1);
    expect(bills.rows[0].change_type).toBe('退押');
    expect(Number(bills.rows[0].change_price)).toBeCloseTo(-payload.change_price, 5);
    expect(bills.rows[0].pay_way).toBe(payload.method);

    const depositInfo = await request(app)
      .get(`/api/orders/${orderId}/deposit-info`);

    expect(depositInfo.statusCode).toBe(200);
    expect(depositInfo.body.success).toBe(true);
    expect(Number(depositInfo.body.data.deposit)).toBeCloseTo(300, 5);
    expect(Number(depositInfo.body.data.refunded)).toBeCloseTo(payload.change_price, 5);
    expect(Number(depositInfo.body.data.remaining)).toBeCloseTo(180, 5);
  });

  test('退还全部押金成功', async () => {
    const orderId = `${REFUND_PREFIX}FULL_${Date.now()}`;
    const depositAmount = 150;
    await createOrder([buildCheckedOutOrder({ orderId, deposit: depositAmount })]);

    const payload = {
      order_id: orderId,
      change_price: depositAmount,
      method: '现金',
      notes: '全额退押金',
      refundTime: '2025-12-12T18:30:00Z'
    };

    const response = await request(app)
      .post(`/api/orders/${orderId}/refund-deposit`)
      .send(payload);

    expect(response.statusCode).toBe(200);
    expect(response.body.order).toBeDefined();
    expect(response.body.order.change_type).toBe('退押');
    expect(Number(response.body.order.change_price)).toBeCloseTo(-depositAmount, 5);

    const bills = await query(
      `SELECT change_price FROM bills WHERE order_id = $1`,
      [orderId]
    );
    expect(bills.rows.length).toBe(1);
    expect(Number(bills.rows[0].change_price)).toBeCloseTo(-depositAmount, 5);

    const depositInfo = await request(app)
      .get(`/api/orders/${orderId}/deposit-info`);

    expect(depositInfo.statusCode).toBe(200);
    expect(depositInfo.body.success).toBe(true);
    expect(Number(depositInfo.body.data.deposit)).toBeCloseTo(depositAmount, 5);
    expect(Number(depositInfo.body.data.refunded)).toBeCloseTo(depositAmount, 5);
    expect(Number(depositInfo.body.data.remaining)).toBeCloseTo(0, 5);
  });
});
