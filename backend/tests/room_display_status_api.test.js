const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const {
  authedRequest,
  roomTypes,
  rooms,
  buildOrderPayload,
  addRoomType,
  addRoom
} = require('./tools');
const { createOrder } = require('../modules/order-create/orderCreate.service');

const TEST_PREFIX = 'DISPLAY_STATUS_API_';

const clearTestOrders = async () => {
  await query('DELETE FROM orders WHERE order_id LIKE $1', [`${TEST_PREFIX}%`]);
};

const findRoom = (roomList, roomNumber) => (roomList || []).find(r => r.room_number === roomNumber);

describe('房态 API - display_status（SQL计算）', () => {
  beforeAll(async () => {
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });

  afterEach(async () => {
    await clearTestOrders();
  });

  afterAll(async () => {
    await clearTestOrders();
  });

  test('GET /api/rooms?date 返回 display_status=reserved（订单pending）', async () => {
    const orderId = `${TEST_PREFIX}PENDING`;
    const orderPayload = buildOrderPayload({
      orderId,
      guestName: '测试客人',
      roomType: 'asu_xiao_zhu',
      roomNumber: '103',
      checkInDate: '2025-12-10',
      checkOutDate: '2025-12-11',
      roomPrice: { '2025-12-10': 288 },
      status: 'pending',
      stayType: '客房'
    });

    await createOrder(orderPayload);

    const res = await authedRequest().get('/api/rooms').query({ date: '2025-12-10' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const room103 = findRoom(res.body.data, '103');
    expect(room103).toBeTruthy();
    expect(room103.display_status).toBe('reserved');
    expect(room103.order_status).toBe('pending');
    expect(room103.order_id).toBe(orderId);
  });

  test('GET /api/rooms?date 返回 display_status=reserved（订单reserved）', async () => {
    const orderId = `${TEST_PREFIX}RESERVED`;
    const orderPayload = buildOrderPayload({
      orderId,
      guestName: '测试客人_reserved',
      roomType: 'asu_xiao_zhu',
      roomNumber: '105',
      checkInDate: '2025-12-20',
      checkOutDate: '2025-12-21',
      roomPrice: { '2025-12-20': 288 },
      status: 'reserved',
      stayType: '客房'
    });

    await createOrder(orderPayload);

    const res = await authedRequest().get('/api/rooms').query({ date: '2025-12-20' });
    expect(res.statusCode).toBe(200);

    const room105 = findRoom(res.body.data, '105');
    expect(room105).toBeTruthy();
    expect(room105.display_status).toBe('reserved');
    expect(room105.order_status).toBe('reserved');
    expect(room105.order_id).toBe(orderId);
  });

  test('GET /api/rooms?date 返回 display_status=occupied（订单occupied）', async () => {
    const orderId = `${TEST_PREFIX}OCCUPIED`;
    const orderPayload = buildOrderPayload({
      orderId,
      guestName: '测试客人_occupied',
      roomType: 'asu_xiao_zhu',
      roomNumber: '106',
      checkInDate: '2025-12-21',
      checkOutDate: '2025-12-22',
      roomPrice: { '2025-12-21': 288 },
      status: 'occupied',
      stayType: '客房'
    });

    await createOrder(orderPayload);

    const res = await authedRequest().get('/api/rooms').query({ date: '2025-12-21' });
    expect(res.statusCode).toBe(200);

    const room106 = findRoom(res.body.data, '106');
    expect(room106).toBeTruthy();
    expect(room106.display_status).toBe('occupied');
    expect(room106.order_status).toBe('occupied');
    expect(room106.order_id).toBe(orderId);
  });

  test('订单状态优先于清扫状态（display_status=reserved）', async () => {
    // tools.js 中 113 的 room.status 预置为 cleaning
    // 但当房间有订单时，前台优先看到订单状态（reserved）而非清扫状态
    const orderId = `${TEST_PREFIX}ORDER_PRIORITY`;
    const orderPayload = buildOrderPayload({
      orderId,
      guestName: '测试客人2',
      roomType: 'you_ge_yuan_zi',
      roomNumber: '113',
      checkInDate: '2025-12-12',
      checkOutDate: '2025-12-13',
      roomPrice: { '2025-12-12': 388 },
      status: 'pending',
      stayType: '客房'
    });

    await createOrder(orderPayload);

    const res = await authedRequest().get('/api/rooms').query({ date: '2025-12-12' });
    expect(res.statusCode).toBe(200);

    const room113 = findRoom(res.body.data, '113');
    expect(room113).toBeTruthy();
    // 订单状态优先：显示 reserved 而非 cleaning
    expect(room113.display_status).toBe('reserved');
    expect(room113.order_id).toBe(orderId);
    expect(room113.order_status).toBe('pending');
  });

  test('GET /api/rooms/status-range 返回区间内每日 display_status', async () => {
    const orderId = `${TEST_PREFIX}RANGE`;
    const orderPayload = buildOrderPayload({
      orderId,
      guestName: '测试客人3',
      roomType: 'asu_xiao_zhu',
      roomNumber: '108',
      checkInDate: '2025-12-16',
      checkOutDate: '2025-12-19',
      roomPrice: {
        '2025-12-16': 288,
        '2025-12-17': 288,
        '2025-12-18': 288
      },
      status: 'pending',
      stayType: '客房'
    });

    await createOrder(orderPayload);

    const res = await authedRequest()
      .get('/api/rooms/status-range')
      .query({ roomNumber: '108', startDate: '2025-12-15', endDate: '2025-12-18' });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(4);

    const map = res.body.data.reduce((acc, row) => {
      acc[row.stay_date] = row.display_status;
      return acc;
    }, {});

    expect(map['2025-12-15']).toBe('available');
    expect(map['2025-12-16']).toBe('reserved');
    expect(map['2025-12-17']).toBe('reserved');
    expect(map['2025-12-18']).toBe('reserved');
  });
});
