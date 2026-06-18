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

const TEST_PREFIX = 'CHANGE_ROOM_CROSS_TYPE_';

// 清理本用例写入的订单数据
const clearTestOrders = async () => {
  await query('DELETE FROM orders WHERE order_id LIKE $1', [`${TEST_PREFIX}%`]);
};

describe('更换房间 API - 跨房型更换', () => {
  beforeAll(async () => {
    // 初始化房型与房间数据，确保测试房间可用
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });

  afterEach(async () => {
    // 每个用例后清理订单，避免互相影响
    await clearTestOrders();
  });

  afterAll(async () => {
    // 最终兜底清理测试数据
    await clearTestOrders();
  });

  test('允许跨房型更换并更新订单房型与价格', async () => {
    // 构造一个待入住订单，初始房型为 bo_ye_shuang
    const orderId = `${TEST_PREFIX}PENDING`;
    const orderPayload = buildOrderPayload({
      orderId,
      roomType: 'bo_ye_shuang',
      roomNumber: '202',
      checkInDate: '2025-12-10',
      checkOutDate: '2025-12-11',
      roomPrice: { '2025-12-10': 258.0 },
      status: 'pending',
      stayType: '客房',
    });

    await createOrder(orderPayload);

    // 将订单从 202 更换到 401（跨房型：yun_ju_ying_yin）
    const res = await authedRequest()
      .post('/api/rooms/change-room')
      .send({
        orderNumber: orderId,
        oldRoomNumber: '202',
        newRoomNumber: '401'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // 校验订单房间号、房型与总价已更新（1 晚价格为 428）
    const { rows } = await query(
      'SELECT room_number, room_type, total_price FROM orders WHERE order_id = $1',
      [orderId]
    );

    expect(rows.length).toBe(1);
    expect(rows[0].room_number).toBe('401');
    expect(rows[0].room_type).toBe('yun_ju_ying_yin');
    expect(Number(rows[0].total_price)).toBe(428);

    // 校验接口返回的新房间信息
    expect(res.body.newRoom?.room_number).toBe('401');
    expect(res.body.newRoom?.type_code).toBe('yun_ju_ying_yin');
  });
});
