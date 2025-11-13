const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { addRoomType, addRoom, createOrder } = require('./tools');

const TEST_ROOM_TYPE = {
  type_code: 'CI_TEST_ROOM_TYPE',
  type_name: '自动化测试房型',
  base_price: 199.0,
  description: '办理入住测试专用房型',
  is_closed: false
};

const TEST_ROOM = {
  room_number: 'CI_ROOM_301',
  type_code: TEST_ROOM_TYPE.type_code,
  status: 'available',
  price: 199.0,
  is_closed: false
};

const ORDER_PREFIX = 'CI_TEST_ORDER_';
const FAST_ORDER_PREFIX = 'CI_FAST_ORDER_';
const ORDER_PREFIXES = [ORDER_PREFIX, FAST_ORDER_PREFIX];
const buildOrderId = (prefix) => `${prefix}${Date.now()}_${Math.floor(Math.random() * 1000)}`;

async function seedRoomFixtures() {
  const orderIdsResult = await query('SELECT order_id FROM orders WHERE room_number = $1', [TEST_ROOM.room_number]);
  if (orderIdsResult.rows.length > 0) {
    const orderIds = orderIdsResult.rows.map(row => row.order_id);
    await query('DELETE FROM bills WHERE order_id = ANY($1)', [orderIds]);
    await query('DELETE FROM orders WHERE order_id = ANY($1)', [orderIds]);
  }
  await query('DELETE FROM rooms WHERE room_number = $1', [TEST_ROOM.room_number]);
  await query('DELETE FROM room_types WHERE type_code = $1', [TEST_ROOM_TYPE.type_code]);
  await addRoomType([TEST_ROOM_TYPE]);
  await addRoom([TEST_ROOM]);
}

async function cleanupRoomFixtures() {
  await query('DELETE FROM rooms WHERE room_number = $1', [TEST_ROOM.room_number]);
  await query('DELETE FROM room_types WHERE type_code = $1', [TEST_ROOM_TYPE.type_code]);
}

async function insertOrder({
  orderId,
  status = 'pending',
  checkInDate = '2025-11-01',
  checkOutDate = '2025-11-03',
  deposit = 0
}) {
  await createOrder([
    {
      order_id: orderId,
      id_source: 'test_source',
      order_source: '自动化测试',
      guest_name: '测试用户',
      room_type: TEST_ROOM_TYPE.type_code,
      room_number: TEST_ROOM.room_number,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      status,
      payment_method: 'cash',
      phone: '13900000000',
      total_price: 398.0,
      deposit,
      stay_type: '客房',
      create_time: new Date().toISOString(),
      remarks: '办理入住测试'
    }
  ]);
}

async function resetOrdersAndRoom() {
  for (const prefix of ORDER_PREFIXES) {
    await query('DELETE FROM bills WHERE order_id LIKE $1', [`${prefix}%`]);
    await query('DELETE FROM orders WHERE order_id LIKE $1', [`${prefix}%`]);
  }
  await query('UPDATE rooms SET status = $1 WHERE room_number = $2', ['available', TEST_ROOM.room_number]);
}

beforeAll(async () => {
  await seedRoomFixtures();
});

afterEach(async () => {
  await resetOrdersAndRoom();
});

afterAll(async () => {
  try {
    await cleanupRoomFixtures();
  } catch (err) {
    if (!/pool/i.test(err.message) || !/end/.test(err.message)) {
      throw err;
    }
  }
});

describe('办理入住接口', () => {
  test('收取押金办理入住会生成押金账单', async () => {
    const orderId = `${ORDER_PREFIX}SUCCESS`;
    const depositAmount = 300;

    await insertOrder({ orderId });

    const response = await request(app)
      .post(`/api/orders/${orderId}/check-in`)
      .send({ deposit: depositAmount });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('办理入住成功');
    expect(response.body.data.order.status).toBe('checked-in');
    expect(Number(response.body.data.order.deposit)).toBeCloseTo(depositAmount, 5);
    expect(response.body.data.bills.length).toBe(3);
    expect(response.body.data.bills.filter(bill => bill.change_type === '收押').length).toBe(1);

    const bills = await query('SELECT change_type, change_price FROM bills WHERE order_id = $1', [orderId]);
    expect(bills.rows.length).toBe(3);
    expect(bills.rows.filter(row => row.change_type === '收押').length).toBe(1);
    expect(bills.rows.filter(row => row.change_type === '房费').length).toBe(2);
    expect(Number(bills.rows.find(row => row.change_type === '收押').change_price)).toBeCloseTo(depositAmount, 5);

    const updatedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [orderId]);
    expect(updatedOrder.rows[0].status).toBe('checked-in');
    expect(Number(updatedOrder.rows[0].deposit)).toBeCloseTo(depositAmount, 5);

    const roomStatus = await query('SELECT status FROM rooms WHERE room_number = $1', [TEST_ROOM.room_number]);
    expect(roomStatus.rows[0].status).toBe('occupied');
  });

  test('未收取押金办理入住仅生成房费账单', async () => {
    const orderId = `${ORDER_PREFIX}NO_DEPOSIT`;

    await insertOrder({ orderId, deposit: 0 });

    const response = await request(app)
      .post(`/api/orders/${orderId}/check-in`)
      .send({});

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.order.status).toBe('checked-in');
    expect(Number(response.body.data.order.deposit || 0)).toBeCloseTo(0, 5);
    expect(response.body.data.bills.length).toBe(2);
    expect(response.body.data.bills.every(bill => bill.change_type === '房费')).toBe(true);

    const bills = await query('SELECT change_type, change_price FROM bills WHERE order_id = $1', [orderId]);
    expect(bills.rows.length).toBe(2);
    expect(bills.rows.every(row => row.change_type === '房费')).toBe(true);
    expect(bills.rows.every(row => Number(row.change_price) > 0)).toBe(true);

    const updatedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [orderId]);
    expect(updatedOrder.rows[0].status).toBe('checked-in');
    expect(Number(updatedOrder.rows[0].deposit || 0)).toBeCloseTo(0, 5);
  });

  test('未传押金字段时使用订单原有押金金额', async () => {
    const orderId = `${ORDER_PREFIX}KEEP_DEPOSIT`;
    const originalDeposit = 180;

    await insertOrder({ orderId, deposit: originalDeposit });

    const response = await request(app)
      .post(`/api/orders/${orderId}/check-in`)
      .send({});

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.order.deposit)).toBeCloseTo(originalDeposit, 5);
    expect(response.body.data.bills.length).toBe(3);
    expect(response.body.data.bills.filter(bill => bill.change_type === '收押').length).toBe(1);

    const bills = await query('SELECT change_type, change_price FROM bills WHERE order_id = $1', [orderId]);
    expect(bills.rows.length).toBe(3);
    expect(bills.rows.filter(row => row.change_type === '收押').length).toBe(1);
    expect(Number(bills.rows.find(row => row.change_type === '收押').change_price)).toBeCloseTo(originalDeposit, 5);

    const updatedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [orderId]);
    expect(updatedOrder.rows[0].status).toBe('checked-in');
    expect(Number(updatedOrder.rows[0].deposit)).toBeCloseTo(originalDeposit, 5);
  });

  test('订单不存在时返回 404', async () => {
    const response = await request(app)
      .post(`/api/orders/${ORDER_PREFIX}NOT_FOUND/check-in`)
      .send({ deposit: 100 });

    expect(response.statusCode).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('订单不存在');
  });

  test('非待入住状态无法办理入住', async () => {
    const orderId = `${ORDER_PREFIX}STATUS_ERR`;

    await insertOrder({ orderId, status: 'checked-in', deposit: 100 });

    const response = await request(app)
      .post(`/api/orders/${orderId}/check-in`)
      .send({ deposit: 200 });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(`订单状态为 'checked-in'，无法办理入住，只有待入住订单可以办理`);

    const bills = await query('SELECT COUNT(*) FROM bills WHERE order_id = $1', [orderId]);
    expect(Number(bills.rows[0].count)).toBe(0);

    const storedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [orderId]);
    expect(storedOrder.rows[0].status).toBe('checked-in');
    expect(Number(storedOrder.rows[0].deposit)).toBeCloseTo(100, 5);
  });
});

describe('快速入住接口', () => {
  const buildFastCheckInPayload = (overrides = {}) => ({
    order_id: buildOrderId(FAST_ORDER_PREFIX),
    id_source: 'fast_source',
    order_source: '前台快速入住',
    guest_name: '快速入住用户',
    phone: '13999990000',
    room_type: TEST_ROOM_TYPE.type_code,
    room_number: TEST_ROOM.room_number,
    check_in_date: '2025-12-01',
    check_out_date: '2025-12-03',
    status: 'checked-in',
    payment_method: 'cash',
    total_price: {
      '2025-12-01': 199.0,
      '2025-12-02': 199.0
    },
    deposit: 300,
    stay_type: '客房',
    create_time: '2025-11-30T12:00:00Z',
    remarks: '快速入住测试',
    ...overrides
  });

  test('成功快速入住创建订单和账单', async () => {
    const payload = buildFastCheckInPayload({
      total_price: {
        '2025-12-01': '199.0',
        '2025-12-02': '199.0'
      }
    });

    const response = await request(app)
      .post('/api/orders/fast-check-in')
      .send(payload);

    if (response.statusCode !== 200) {
      throw new Error(`快速入住接口返回异常: ${JSON.stringify(response.body)}`);
    }
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('快速入住成功');
    expect(response.body.data).toHaveProperty('order');
    expect(response.body.data).toHaveProperty('bills');
    expect(response.body.data.order.order_id).toBe(payload.order_id);
    expect(response.body.data.order.status).toBe('checked-in');
    expect(Number(response.body.data.order.deposit)).toBeCloseTo(payload.deposit, 5);

    const bills = response.body.data.bills;
    expect(bills.length).toBe(3);
    expect(bills.filter(bill => bill.change_type === '房费').length).toBe(2);
    expect(bills.some(bill => bill.change_type === '收押')).toBe(true);

    const storedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [payload.order_id]);
    expect(storedOrder.rows[0].status).toBe('checked-in');
    expect(Number(storedOrder.rows[0].deposit)).toBeCloseTo(payload.deposit, 5);

    const storedBills = await query('SELECT change_type FROM bills WHERE order_id = $1', [payload.order_id]);
    expect(storedBills.rows.length).toBe(3);

    const roomStatus = await query('SELECT status FROM rooms WHERE room_number = $1', [TEST_ROOM.room_number]);
    expect(roomStatus.rows[0].status).toBe('occupied');
  });

  test('缺少必填字段时返回 400', async () => {
    const payload = buildFastCheckInPayload({
      order_id: `${FAST_ORDER_PREFIX}INVALID`
    });
    delete payload.order_id;

    const response = await request(app)
      .post('/api/orders/fast-check-in')
      .send(payload);

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('请求参数验证失败');

    const orderCount = await query(
      'SELECT COUNT(*) FROM orders WHERE order_id LIKE $1',
      [`${FAST_ORDER_PREFIX}%`]
    );
    expect(Number(orderCount.rows[0].count)).toBe(0);
  });
});
