const app = require('../app');
const request = require('supertest');
const { query } = require('../database/postgreDB/pg');
const {
  authedRequest,
  rooms,
  addRoom,
  roomTypes,
  addRoomType,
  buildOrderPayload,
  createOrder
} = require('./tools');

const VALID_ROOM_STATES = ['available', 'occupied', 'cleaning', 'repair', 'reserved'];


describe('房间参数验证', () => {
  test('POST /api/rooms 缺少必填字段时返回 400', async () => {
    const invalidPayload = { room_number: 'PARAM_101' };

    const response = await authedRequest()
      .post('/api/rooms')
      .send(invalidPayload);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('请求数据格式错误');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  test('POST /api/rooms status 非法时返回 400', async () => {
    const invalidPayload = {
      room_number: 'PARAM_102',
      type_code: 'TEST_TYPE',
      status: 'invalid-status',
      price: 180
    };

    const response = await authedRequest()
      .post('/api/rooms')
      .send(invalidPayload);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('请求数据格式错误');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  test('PATCH /api/rooms/:number/status 请求体为空时返回 400', async () => {
    const response = await authedRequest()
      .patch('/api/rooms/PARAM_103/status')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('请求体为空');
  });

  test('PATCH /api/rooms/:number/status 状态非法时返回 400', async () => {
    const response = await authedRequest()
      .patch('/api/rooms/PARAM_104/status')
      .send({ status: 'invalid-status' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('无效的房间状态');
    expect(response.body.validStatuses).toEqual(VALID_ROOM_STATES);
  });
});

describe('房间接口测试', () => {

  beforeAll(async () => {
    // 确保房型表中有一个房型用于测试房间添加
    await query(`
      INSERT INTO room_types (type_code, type_name, base_price)
      VALUES ('TEST_TYPE', '测试房型', 100)
      ON CONFLICT (type_code) DO NOTHING;
    `);
  });

  afterAll(async () => {
    // 清理测试数据
    await query(`DELETE FROM rooms WHERE type_code = 'TEST_TYPE';`);
    await query(`DELETE FROM room_types WHERE type_code = 'TEST_TYPE';`);
  });

  test('添加房间', async () => {
    const newRoom = {
      room_number: '101',
      type_code: 'TEST_TYPE',
      status: 'available',
      price: 150
    };

    const response = await authedRequest()
      .post('/api/rooms')
      .send(newRoom);

    expect(response.statusCode).toBe(201);
    expect(response.body.data).toHaveProperty('room_number', '101');
    expect(response.body.data).toHaveProperty('type_code', 'TEST_TYPE');
    expect(response.body.data).toHaveProperty('status', 'available');
  });

  test('更新房间信息', async () => {
    const updatedRoom = {
      room_number: '101',
      type_code: 'TEST_TYPE',
      status: 'occupied',
      price: 180
    };

    const response = await authedRequest()
      .put('/api/rooms/101')
      .send(updatedRoom);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'occupied');
    expect(parseFloat(response.body.data.price)).toBe(180);
  });



});

describe('更新房间状态' , () => {

  beforeAll(async () => {
    // 添加测试房间
    await query(`
      INSERT INTO room_types (type_code, type_name, base_price)
      VALUES ('TEST_TYPE', '测试房型', 100)
      ON CONFLICT (type_code) DO NOTHING;
    `);

    await query(`
      INSERT INTO rooms (room_number, type_code, status, price)
      VALUES ('101', 'TEST_TYPE', 'available', 150)
      ON CONFLICT (room_number) DO NOTHING;
    `);
  });

  beforeEach(async () => {
    // 每次测试前将房间状态重置为 available
    await query(`
      UPDATE rooms SET status = 'available' WHERE room_number = '101';
    `);
  });

  afterAll(async () => {
    // 清理测试数据
    await query(`DELETE FROM rooms WHERE room_number = '101';`);
    await query(`DELETE FROM room_types WHERE type_code = 'TEST_TYPE';`);
  });

  test('更新房间状态 - repair', async () => {
    const response = await authedRequest()
      .patch('/api/rooms/101/status')
      .send({ status: 'repair' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'repair');
  });

  test('更新房间状态 - cleaning', async () => {
    const response = await authedRequest()
      .patch('/api/rooms/101/status')
      .send({ status: 'cleaning' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'cleaning');
  });

  test('更新房间状态 - reserved', async () => {
    const response = await authedRequest()
      .patch('/api/rooms/101/status')
      .send({ status: 'reserved' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'reserved');
  });

  test('更新房间状态 - occupied', async () => {
    const response = await authedRequest()
      .patch('/api/rooms/101/status')
      .send({ status: 'occupied' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'occupied');
  });

  test('更新房间状态 - available', async () => {
    const response = await authedRequest()
      .patch('/api/rooms/101/status')
      .send({ status: 'available' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'available');
  });
});

describe('获取可用房间列表', () => {
  const AVAILABLE_TYPE = 'TEST_TYPE_AVAILABLE';
  const AVAILABLE_ROOMS = ['A201', 'A202', 'A203', 'A204'];

  const buildRoomPriceMap = (startDate, endDate) => {
    const prices = {};
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 休息房（同日进出）也需要一条价格
    if (start.getTime() === end.getTime()) {
      prices[startDate] = 200;
      return prices;
    }

    let cursor = new Date(start);
    let dayIndex = 0;
    while (cursor < end) {
      const dateKey = cursor.toISOString().split('T')[0];
      prices[dateKey] = 200 + dayIndex * 10;
      cursor.setDate(cursor.getDate() + 1);
      dayIndex += 1;
    }

    return prices;
  };

  const resetTestRooms = async () => {
    await query('DELETE FROM orders WHERE room_number = ANY($1::text[])', [AVAILABLE_ROOMS]);
    await query('DELETE FROM rooms WHERE room_number = ANY($1::text[])', [AVAILABLE_ROOMS]);
    await query(`
      INSERT INTO rooms (room_number, type_code, status, price, is_closed)
      VALUES
        ('A201', $1, 'available', 200, FALSE),
        ('A202', $1, 'available', 220, FALSE),
        ('A203', $1, 'available', 240, FALSE),
        ('A204', $1, 'available', 260, FALSE)
      ON CONFLICT (room_number) DO UPDATE
        SET type_code = EXCLUDED.type_code,
            status = EXCLUDED.status,
            price = EXCLUDED.price,
            is_closed = FALSE;
    `, [AVAILABLE_TYPE]);
  };

  const insertTestOrder = async ({
    orderId,
    roomNumber,
    checkInDate,
    checkOutDate,
    status = 'pending'
  }) => {
    const payload = buildOrderPayload({
      orderId,
      guestName: `测试客人-${orderId}`,
      roomType: AVAILABLE_TYPE,
      roomNumber,
      checkInDate,
      checkOutDate,
      status: status ?? 'pending',
      paymentMethod: '现金',
      deposit: 50,
      roomPrice: buildRoomPriceMap(checkInDate, checkOutDate),
      stayType: '客房'
    });

    await createOrder(payload);
  };

  beforeAll(async () => {
    await query(`
      INSERT INTO room_types (type_code, type_name, base_price)
      VALUES ($1, '可用房间测试房型', 150)
      ON CONFLICT (type_code) DO NOTHING;
    `, [AVAILABLE_TYPE]);
  });

  beforeEach(async () => {
    await resetTestRooms();
  });

  afterAll(async () => {
    await query('DELETE FROM orders WHERE order_id LIKE $1', ['TEST_AVAIL_%']);
    await query('DELETE FROM rooms WHERE room_number = ANY($1::text[])', [AVAILABLE_ROOMS]);
    await query('DELETE FROM room_types WHERE type_code = $1', [AVAILABLE_TYPE]);
  });

  test('同一天入住退房时，已被占用的房间不会在可用列表中', async () => {
    // 创建一个休息订单
    await insertTestOrder({
      orderId: 'TEST_AVAIL_REST_1',
      roomNumber: 'A201',
      checkInDate: '2024-12-01',
      checkOutDate: '2024-12-01'
    });

    // 查询该天的可用房间
    const response = await authedRequest()
      .get('/api/rooms/available')
      .query({ startDate: '2024-12-01', endDate: '2024-12-01' });

    expect(response.statusCode).toBe(200);
    const availableNumbers = response.body.data.map(room => room.room_number);
    expect(availableNumbers).not.toContain('A201');
    expect(availableNumbers).toEqual(expect.arrayContaining(['A202', 'A203', 'A204']));
  });

  test('多日订单会阻止覆盖区间内的房间出现在可用列表中', async () => {
    await insertTestOrder({
      orderId: 'TEST_AVAIL_MULTI_1',
      roomNumber: 'A202',
      checkInDate: '2024-12-10',
      checkOutDate: '2024-12-15'
    });
    await insertTestOrder({
      orderId: 'TEST_AVAIL_MULTI_2',
      roomNumber: 'A203',
      checkInDate: '2024-12-11',
      checkOutDate: '2024-12-13'
    });

    const response = await authedRequest()
      .get('/api/rooms/available')
      .query({ startDate: '2024-12-12', endDate: '2024-12-14' });

    expect(response.statusCode).toBe(200);
    const availableNumbers = response.body.data.map(room => room.room_number);
    expect(availableNumbers).not.toContain('A202');
    expect(availableNumbers).not.toContain('A203');
    expect(availableNumbers).toEqual(expect.arrayContaining(['A201', 'A204']));
  });

  test('创建 2025-10-10 至 2025-10-15 的 1 个订单，检查可用房间列表', async () => {
    await insertTestOrder({
      orderId: 'TEST_AVAIL_FUTURE_1',
      roomNumber: 'A204',
      checkInDate: '2025-10-10',
      checkOutDate: '2025-10-15'
    });

    const response = await authedRequest()
      .get('/api/rooms/available')
      .query({ startDate: '2025-10-10', endDate: '2025-10-15' });

    expect(response.statusCode).toBe(200);
    const availableNumbers = response.body.data.map(room => room.room_number);
    expect(availableNumbers).not.toContain('A204');
    expect(availableNumbers).toEqual(expect.arrayContaining(['A201', 'A202', 'A203']));


    const response2 = await authedRequest()
      .get('/api/rooms/available')
      .query({ startDate: '2025-10-07', endDate: '2025-10-13' });

    expect(response2.statusCode).toBe(200);
    const availableNumbers2 = response2.body.data.map(room => room.room_number);
    expect(availableNumbers2).not.toContain('A204');
    expect(availableNumbers2).toEqual(expect.arrayContaining(['A201', 'A202', 'A203']));

    const response3 = await authedRequest()
      .get('/api/rooms/available')
      .query({ startDate: '2025-10-11', endDate: '2025-10-14' });

    expect(response3.statusCode).toBe(200);
    const availableNumbers3 = response3.body.data.map(room => room.room_number);
    expect(availableNumbers3).not.toContain('A204');
    expect(availableNumbers3).toEqual(expect.arrayContaining(['A201', 'A202', 'A203']));

    const response4 = await authedRequest()
      .get('/api/rooms/available')
      .query({ startDate: '2025-10-13', endDate: '2025-10-20' });
    expect(response4.statusCode).toBe(200);
    const availableNumbers4 = response4.body.data.map(room => room.room_number);
    expect(availableNumbers4).not.toContain('A204');
    expect(availableNumbers4).toEqual(expect.arrayContaining(['A201', 'A202', 'A203']));


  });

  test('创建多个订单，检查部分重叠日期的可用房间列表', async () => {
    await insertTestOrder({
      orderId: 'TEST_AVAIL_MULTI_ORD_1',
      roomNumber: 'A201',
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-05'
    });
    await insertTestOrder({
      orderId: 'TEST_AVAIL_MULTI_ORD_2',
      roomNumber: 'A202',
      checkInDate: '2025-11-03',
      checkOutDate: '2025-11-07'
    });
    await insertTestOrder({
      orderId: 'TEST_AVAIL_MULTI_ORD_3',
      roomNumber: 'A203',
      checkInDate: '2025-11-06',
      checkOutDate: '2025-11-10'
    });

    const response = await authedRequest()
      .get('/api/rooms/available')
      .query({ startDate: '2025-11-04', endDate: '2025-11-08' });

    expect(response.statusCode).toBe(200);
    const availableNumbers = response.body.data.map(room => room.room_number);
    expect(availableNumbers).not.toContain('A201');
    expect(availableNumbers).not.toContain('A202');
    expect(availableNumbers).not.toContain('A203');
    expect(availableNumbers).toEqual(expect.arrayContaining(['A204']));

    const response2 = await authedRequest()
      .get('/api/rooms/available')
      .query({ startDate: '2025-11-05', endDate: '2025-11-06' });

    expect(response2.statusCode).toBe(200);
    const availableNumbers2 = response2.body.data.map(room => room.room_number);
    expect(availableNumbers2).not.toContain('A202');
    expect(availableNumbers2).toEqual(expect.arrayContaining(['A201', 'A203', 'A204']));

  });



});

describe('获取房间', () => {
  test('获取房间列表，确保响应正确', async () => {

    await addRoomType(roomTypes);
    await addRoom(rooms);

    const response = await authedRequest()
      .get('/api/rooms/');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(rooms.length);
  });

  test('根据房间号获取房间信息', async () => {
    const response = await authedRequest()
      .get('/api/rooms/number/101');

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('room_number', '101');
  });
});
