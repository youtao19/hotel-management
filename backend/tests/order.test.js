const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const {roomTypes,rooms,ORDERS,addRoom,addRoomType} = require('./tools');
const { createOrder } = require('../modules/orderModule');

describe('创建订单后更换房间接口', () => {
  const orderTemplate = {
    ...ORDERS[0],
    orderId: 'TEST_CHANGE_ROOM_ORDER',
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
    const orderNumber = targetOrder.orderId;
    const oldRoomNumber = targetOrder.roomNumber;
    const newRoom = rooms.find(
      room =>
        room.type_code === targetOrder.roomType &&
        room.roomNumber !== oldRoomNumber &&
        room.status === 'available'
    );

    expect(newRoom).toBeDefined();

    const response = await request(app)
      .post('/api/rooms/change-room')
      .send({
        orderNumber,
        oldRoomNumber,
        newRoomNumber: newRoom.roomNumber
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

describe('办理退房接口', () => {
  const CHECKOUT_PREFIX = 'TEST_CHECKOUT_';
  const buildOrderId = (label) => `${CHECKOUT_PREFIX}${label}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const createCheckedInOrder = async (orderId, overrides = {}) => {
    const orderTemplate = {
      ...mockOrders[1],
      order_id: orderId,
      status: 'checked-in',
      deposit: overrides.deposit ?? 200.00,
      ...overrides
    };
    await createOrder([orderTemplate]);
  };

  beforeAll(async () => {
    await query('TRUNCATE bills, orders, rooms, room_types RESTART IDENTITY CASCADE');
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });

  afterEach(async () => {
    await query('DELETE FROM bills WHERE order_id LIKE $1', [`${CHECKOUT_PREFIX}%`]);
    await query('DELETE FROM order_changes WHERE order_id LIKE $1', [`${CHECKOUT_PREFIX}%`]);
    await query('DELETE FROM orders WHERE order_id LIKE $1', [`${CHECKOUT_PREFIX}%`]);
  });

  afterAll(async () => {
    await query('TRUNCATE bills, orders, rooms, room_types RESTART IDENTITY CASCADE');
  });

  test('已入住订单可办理退房', async () => {
    const orderId = buildOrderId('SUCCESS');
    await createCheckedInOrder(orderId, { deposit: 180, payment_method: '现金' });

    const response = await request(app)
      .post(`/api/orders/${orderId}/status`)
      .send({ newStatus: 'checked-out', checkOutTime: new Date().toISOString() });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('订单状态更新成功');
    expect(response.body.order).toBeDefined();
    expect(response.body.order.status).toBe('checked-out');

    const storedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [orderId]);
    expect(storedOrder.rows.length).toBe(1);
    expect(storedOrder.rows[0].status).toBe('checked-out');
    expect(Number(storedOrder.rows[0].deposit)).toBeCloseTo(180, 5);
  });

  test('订单不存在时返回 404', async () => {
    const response = await request(app)
      .post(`/api/orders/${CHECKOUT_PREFIX}MISSING/status`)
      .send({ newStatus: 'checked-out' });

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('未找到订单或更新失败');
  });

  test('非法状态更新请求返回 400 并保持原状态', async () => {
    const orderId = buildOrderId('INVALID');
    await createCheckedInOrder(orderId);

    const response = await request(app)
      .post(`/api/orders/${orderId}/status`)
      .send({ newStatus: 'invalid-status' });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('请求参数验证失败');
    expect(Array.isArray(response.body.errors)).toBe(true);

    const storedOrder = await query('SELECT status FROM orders WHERE order_id = $1', [orderId]);
    expect(storedOrder.rows.length).toBe(1);
    expect(storedOrder.rows[0].status).toBe('checked-in');
  });
});

describe('提前退房 - 未入住直接取消', () => {
  const NO_STAY_PREFIX = 'TEST_NO_STAY_';
  const buildOrderId = (label) => `${NO_STAY_PREFIX}${label}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  beforeAll(async () => {
    await query('TRUNCATE bills, orders, rooms, room_types RESTART IDENTITY CASCADE');
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });

  afterEach(async () => {
    await query('DELETE FROM bills WHERE order_id LIKE $1', [`${NO_STAY_PREFIX}%`]);
    await query('DELETE FROM order_changes WHERE order_id LIKE $1', [`${NO_STAY_PREFIX}%`]);
    await query('DELETE FROM orders WHERE order_id LIKE $1', [`${NO_STAY_PREFIX}%`]);
    await query('UPDATE rooms SET status = $1 WHERE room_number = $2', ['available', 'TEST_ROOM_101']);
  });

  afterAll(async () => {
    await query('TRUNCATE bills, orders, rooms, room_types RESTART IDENTITY CASCADE');
  });

  test('未入住退房会取消订单并释放房间', async () => {
    const orderId = buildOrderId('CANCEL');
    const orderData = {
      ...mockOrders[0],
      order_id: orderId,
      status: 'checked-in',
      room_number: 'TEST_ROOM_101',
      room_type: 'TEST_STD_ROOM',
      deposit: 200,
      payment_method: '现金',
      check_in_date: '2025-10-01',
      check_out_date: '2025-10-03',
      stay_type: '客房'
    };

    await createOrder([orderData]);
    await query('UPDATE rooms SET status = $1 WHERE room_number = $2', ['occupied', orderData.room_number]);

    const refundAmount = 200;
    const response = await request(app)
      .post(`/api/orders/${orderId}/early-checkout`)
      .send({
        actualCheckoutTime: new Date().toISOString(),
        refundAmount,
        refundMethod: '现金',
        hasStayed: false,
        remarks: '看房未入住'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.order).toBeDefined();
    expect(response.body.data.order.status).toBe('cancelled');

    const storedOrder = await query('SELECT status, total_price FROM orders WHERE order_id = $1', [orderId]);
    expect(storedOrder.rows.length).toBe(1);
    expect(storedOrder.rows[0].status).toBe('cancelled');
    expect(Number(storedOrder.rows[0].total_price)).toBe(0);

    const roomStatus = await query('SELECT status FROM rooms WHERE room_number = $1', [orderData.room_number]);
    expect(roomStatus.rows[0].status).toBe('available');

    const refundBills = await query('SELECT change_price, change_type, pay_way FROM bills WHERE order_id = $1', [orderId]);
    const hasRefundBill = refundBills.rows.some(
      bill => bill.change_type === '退款' && Number(bill.change_price) === -refundAmount && bill.pay_way === '现金'
    );
    expect(hasRefundBill).toBe(true);
  });
});
