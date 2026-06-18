const request = require('supertest');
const app = require('../app');
const db = require('../database/postgreDB/pg');
const { authedRequest } = require('./tools');
const { createOrder } = require('../modules/order-create/orderCreate.service');

// 中文注释：构造测试订单，验证订单列表筛选逻辑已下沉到后端接口。
function buildOrderPayload({ orderId, guestName, roomNumber, status, checkInDate, checkOutDate, deposit = 0 }) {
  return {
    orderId,
    sourceNumber: '',
    orderSource: 'front_desk',
    guestName,
    roomType: 'TEST_STD_ROOM',
    roomNumber,
    checkInDate,
    checkOutDate,
    status,
    paymentMethod: '现金',
    phone: '13800138000',
    roomPrice: {
      [checkInDate]: 100
    },
    deposit,
    isPrepaid: false,
    prepaidAmount: 0,
    stayType: '客房',
    remarks: '订单筛选测试'
  };
}

describe('订单列表后端筛选', () => {
  const prefix = `TEST_ORDER_FILTER_${Date.now()}`;
  const orderIds = [
    `${prefix}_A`,
    `${prefix}_B`,
    `${prefix}_C`,
    `${prefix}_D`,
    `${prefix}_E`
  ];

  beforeAll(async () => {
    // 中文注释：准备测试房型与房间，避免受业务数据影响。
    await db.query(
      'INSERT INTO room_types (type_code, type_name, base_price, description, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (type_code) DO NOTHING',
      ['TEST_STD_ROOM', '测试标准房', 100, '订单筛选测试房型', false]
    );
    await db.query(
      'INSERT INTO rooms (room_number, type_code, status, price, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (room_number) DO NOTHING',
      ['TEST_ROOM_201', 'TEST_STD_ROOM', 'available', 100, false]
    );
    await db.query(
      'INSERT INTO rooms (room_number, type_code, status, price, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (room_number) DO NOTHING',
      ['TEST_ROOM_202', 'TEST_STD_ROOM', 'available', 100, false]
    );
    await db.query(
      'INSERT INTO rooms (room_number, type_code, status, price, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (room_number) DO NOTHING',
      ['TEST_ROOM_203', 'TEST_STD_ROOM', 'available', 100, false]
    );
    await db.query(
      'INSERT INTO rooms (room_number, type_code, status, price, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (room_number) DO NOTHING',
      ['TEST_ROOM_204', 'TEST_STD_ROOM', 'available', 100, false]
    );
    await db.query(
      'INSERT INTO rooms (room_number, type_code, status, price, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (room_number) DO NOTHING',
      ['TEST_ROOM_205', 'TEST_STD_ROOM', 'available', 100, false]
    );

    await createOrder(buildOrderPayload({
      orderId: orderIds[0],
      guestName: '筛选客人甲',
      roomNumber: 'TEST_ROOM_201',
      status: 'pending',
      checkInDate: '2026-02-01',
      checkOutDate: '2026-02-02'
    }));
    await createOrder(buildOrderPayload({
      orderId: orderIds[1],
      guestName: '筛选客人乙',
      roomNumber: 'TEST_ROOM_202',
      status: 'checked-in',
      checkInDate: '2026-02-03',
      checkOutDate: '2026-02-04'
    }));
    await createOrder(buildOrderPayload({
      orderId: orderIds[2],
      guestName: '筛选客人丙',
      roomNumber: 'TEST_ROOM_203',
      status: 'cancelled',
      checkInDate: '2026-02-05',
      checkOutDate: '2026-02-06'
    }));
    await createOrder(buildOrderPayload({
      orderId: orderIds[3],
      guestName: '筛选客人丁',
      roomNumber: 'TEST_ROOM_204',
      status: 'checked-out',
      checkInDate: '2026-02-07',
      checkOutDate: '2026-02-08',
      deposit: 100
    }));
    await createOrder(buildOrderPayload({
      orderId: orderIds[4],
      guestName: '筛选客人戊',
      roomNumber: 'TEST_ROOM_205',
      status: 'cancelled',
      checkInDate: '2026-02-09',
      checkOutDate: '2026-02-10',
      deposit: 80
    }));

    // 中文注释：构造退押账单，验证后端返回 remaining_deposit/can_refund_deposit 口径。
    await db.query(
      `INSERT INTO bills (order_id, room_number, guest_name, change_price, change_type, pay_way, remarks, stay_type, stay_date)
       VALUES ($1, $2, $3, $4, '退押', '现金', '测试退押', '客房', $5::date)`,
      [orderIds[3], 'TEST_ROOM_204', '筛选客人丁', -60, '2026-02-07']
    );
    await db.query(
      `INSERT INTO bills (order_id, room_number, guest_name, change_price, change_type, pay_way, remarks, stay_type, stay_date)
       VALUES ($1, $2, $3, $4, '退押', '现金', '测试退押', '客房', $5::date)`,
      [orderIds[4], 'TEST_ROOM_205', '筛选客人戊', -80, '2026-02-09']
    );
  });

  afterAll(async () => {
    await db.query('DELETE FROM bills WHERE order_id LIKE $1', [`${prefix}%`]);
    await db.query('DELETE FROM orders WHERE order_id LIKE $1', [`${prefix}%`]);
  });

  test('支持按关键词搜索订单列表', async () => {
    const response = await authedRequest()
      .get('/api/orders')
      .query({ search: '筛选客人乙' });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].order_id).toBe(orderIds[1]);
  });

  test('支持按状态筛选订单列表', async () => {
    const response = await authedRequest()
      .get('/api/orders')
      .query({ status: 'cancelled' });

    expect(response.statusCode).toBe(200);
    const ids = response.body.data.map((item) => item.order_id);
    expect(ids).toContain(orderIds[2]);
    expect(ids).not.toContain(orderIds[0]);
  });

  test('支持按日期筛选订单列表（匹配入住或退房日期）', async () => {
    const response = await authedRequest()
      .get('/api/orders')
      .query({ date: '2026-02-04' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].order_id).toBe(orderIds[1]);
  });

  test('日期筛选格式不合法时返回 400', async () => {
    const response = await authedRequest()
      .get('/api/orders')
      .query({ date: '2026/02/04' });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('INVALID_DATE_FILTER');
  });

  test('列表返回后端计算的退押资格字段', async () => {
    const response = await authedRequest().get('/api/orders');
    expect(response.statusCode).toBe(200);

    const rowD = response.body.data.find((item) => item.order_id === orderIds[3]);
    const rowE = response.body.data.find((item) => item.order_id === orderIds[4]);

    expect(rowD).toBeTruthy();
    expect(rowE).toBeTruthy();

    expect(Number(rowD.refunded_deposit)).toBeCloseTo(60, 2);
    expect(Number(rowD.remaining_deposit)).toBeCloseTo(40, 2);
    expect(rowD.can_refund_deposit).toBe(true);

    expect(Number(rowE.refunded_deposit)).toBeCloseTo(80, 2);
    expect(Number(rowE.remaining_deposit)).toBeCloseTo(0, 2);
    expect(rowE.can_refund_deposit).toBe(false);
  });
});
