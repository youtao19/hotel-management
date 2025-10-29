const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const {roomTypes,rooms,addRoom,addRoomType,mockOrders,createOrder} = require('./tools');

describe('创建订单后更换房间接口', () => {
  const orderTemplate = {
    ...mockOrders[0],
    order_id: 'TEST_CHANGE_ROOM_ORDER',
    status: 'pending'
  };

  beforeAll(async () => {
    await query('TRUNCATE orders, rooms, room_types RESTART IDENTITY CASCADE');
    await addRoomType(roomTypes);
    await addRoom(rooms);
    await createOrder([orderTemplate]);
  });

  test('创建订单后更换房间', async () => {
    const targetOrder = orderTemplate;
    const orderNumber = targetOrder.order_id;
    const oldRoomNumber = targetOrder.room_number;
    const newRoom = rooms.find(
      room =>
        room.type_code === targetOrder.room_type &&
        room.room_number !== oldRoomNumber &&
        room.status === 'available'
    );

    expect(newRoom).toBeDefined();

    const response = await request(app)
      .post('/api/rooms/change-room')
      .send({
        orderNumber,
        oldRoomNumber,
        newRoomNumber: newRoom.room_number
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('房间更换成功');
    expect(response.body.updatedOrder).toBeDefined();
    expect(response.body.updatedOrder.room_number).toBe(newRoom.room_number);
    expect(response.body.updatedOrder.room_type).toBe(newRoom.type_code);

    // 验证订单的房间号已更新
    const orderResult = await query('SELECT room_number, room_type, total_price, check_in_date, check_out_date FROM orders WHERE order_id = $1', [orderNumber]);
    expect(orderResult.rows[0].room_number).toBe(newRoom.room_number);
    expect(orderResult.rows[0].room_type).toBe(newRoom.type_code);

    const checkInDate = new Date(orderResult.rows[0].check_in_date);
    const checkOutDate = new Date(orderResult.rows[0].check_out_date);
    let nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    if (nights === 0) nights = 1;
    const expectedTotalPrice = Number(newRoom.price) * nights;
    expect(Number(orderResult.rows[0].total_price)).toBeCloseTo(expectedTotalPrice);
  });

  afterAll(async () => {
    await query('TRUNCATE orders, rooms, room_types RESTART IDENTITY CASCADE');
  });
});
