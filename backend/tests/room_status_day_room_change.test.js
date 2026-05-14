const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const {
  roomTypes,
  rooms,
  buildOrderPayload,
  addRoomType,
  addRoom
} = require('./tools');
const { createOrder } = require('../modules/order-create/orderCreate.service');

const TEST_PREFIX = 'ROOM_STATUS_DAY_CHANGE_';

const clearTestOrders = async () => {
  await query('DELETE FROM orders WHERE order_id LIKE $1', [`${TEST_PREFIX}%`]);
};

const findRoom = (roomList, roomNumber) => (roomList || []).find(r => r.room_number === roomNumber);

describe('房间状态 API - 单日换房后旧房应释放', () => {
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

  test('多日订单单日换房后，查询该日房态应以 stay_date 为准', async () => {
    const orderId = `${TEST_PREFIX}MULTI`;
    const orderPayload = buildOrderPayload({
      orderId,
      guestName: '测试客人',
      roomType: 'asu_xiao_zhu',
      roomNumber: '110',
      checkInDate: '2025-12-16',
      checkOutDate: '2025-12-19',
      roomPrice: {
        '2025-12-16': 288,
        '2025-12-17': 288,
        '2025-12-18': 288,
      },
      status: 'pending',
      stayType: '客房',
    });

    await createOrder(orderPayload);

    // 12-17 将房间从 110 更换到 108
    const changeRes = await request(app)
      .put(`/api/orders/${orderId}/day-room`)
      .send({ stayDate: '2025-12-17', newRoomNumber: '108' });

    expect(changeRes.statusCode).toBe(200);
    expect(changeRes.body.success).toBe(true);

    // 查询 12-17 的房态：110 应为空闲，108 应占用
    const res17 = await request(app).get('/api/rooms').query({ date: '2025-12-17' });
    expect(res17.statusCode).toBe(200);
    expect(Array.isArray(res17.body.data)).toBe(true);

    const room110On17 = findRoom(res17.body.data, '110');
    const room108On17 = findRoom(res17.body.data, '108');
    expect(room110On17).toBeTruthy();
    expect(room108On17).toBeTruthy();
    expect(room110On17.order_status).toBeNull();
    expect(room108On17.order_status).toBe('pending');
    expect(room108On17.order_id).toBe(orderId);
    expect(room110On17.display_status).toBe('available');
    expect(room108On17.display_status).toBe('reserved');

    // 同一订单其他日期仍占用原房间 110
    const res16 = await request(app).get('/api/rooms').query({ date: '2025-12-16' });
    expect(res16.statusCode).toBe(200);
    const room110On16 = findRoom(res16.body.data, '110');
    const room108On16 = findRoom(res16.body.data, '108');
    expect(room110On16.order_status).toBe('pending');
    expect(room108On16.order_status).toBeNull();
    expect(room110On16.display_status).toBe('reserved');
    expect(room108On16.display_status).toBe('available');

    const res18 = await request(app).get('/api/rooms').query({ date: '2025-12-18' });
    expect(res18.statusCode).toBe(200);
    const room110On18 = findRoom(res18.body.data, '110');
    expect(room110On18.order_status).toBe('pending');
    expect(room110On18.display_status).toBe('reserved');
  });
});
