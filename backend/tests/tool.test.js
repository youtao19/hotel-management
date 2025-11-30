const app = require('../app');
const request = require('supertest');

const {roomTypes,rooms,ORDERS,addRoomType,addRoom} = require('./tools');
const {createOrder} = require('../modules/orderModule');

describe('工具测试', () => {
  test('添加房间类型', async () => {
    await addRoomType(roomTypes);

    const response = await request(app)
      .get('/api/room-types/');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(roomTypes.length);
  });

  test('添加房间', async () => {
    await addRoom(rooms);

    const response = await request(app)
      .get('/api/rooms/');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(rooms.length);
  });

  test('创建订单', async () => {

    for (const order of ORDERS) {
      await createOrder(order);
    }

    const response = await request(app)
      .get('/api/orders/');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(ORDERS.length);
  });

});
