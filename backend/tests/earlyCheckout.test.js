const request = require('supertest');
const app = require('../app');
const db = require('../database/postgreDB/pg');
const { authedRequest } = require('./tools');
const { createOrder } = require('../modules/order-create/orderCreate.service');

describe('提前退房接口', () => {
  beforeAll(async () => {
    await db.query(
      'INSERT INTO room_types (type_code, type_name, base_price, description, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (type_code) DO NOTHING',
      ['TEST_EC_ROOM', '提前退房测试房型', 100, '提前退房接口测试房型', false]
    );
    await db.query(
      'INSERT INTO rooms (room_number, type_code, status, price, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (room_number) DO NOTHING',
      ['TEST_EC01', 'TEST_EC_ROOM', 'available', 100, false]
    );
    await db.query(
      'INSERT INTO rooms (room_number, type_code, status, price, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (room_number) DO NOTHING',
      ['TEST_EC02', 'TEST_EC_ROOM', 'available', 100, false]
    );
  });

  test('已入住订单提前退房时，应当删除未住日期、写退款账单并把房间设为清洁中', async () => {
    const orderId = `TEST_EC_STAY_${Date.now()}`;

    await createOrder({
      orderId,
      sourceNumber: '',
      orderSource: 'front_desk',
      guestName: '提前退房测试客人',
      roomType: 'TEST_EC_ROOM',
      roomNumber: 'TEST_EC01',
      checkInDate: '2026-01-10',
      checkOutDate: '2026-01-13',
      status: 'checked-in',
      paymentMethod: '现金',
      phone: '',
      roomPrice: {
        '2026-01-10': 100,
        '2026-01-11': 120,
        '2026-01-12': 130
      },
      deposit: 0,
      isPrepaid: false,
      prepaidAmount: 0,
      stayType: '客房',
      remarks: '提前退房接口测试'
    });

    const response = await authedRequest()
      .post(`/api/orders/${orderId}/early-checkout`)
      .send({
        actualCheckoutTime: '2026-01-11T09:00',
        refundAmount: 250,
        refundMethod: '现金',
        hasStayed: true,
        remarks: '客人提前离店'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('提前退房办理成功');
    expect(response.body.data.refundedStayDates).toEqual(['2026-01-11', '2026-01-12']);
    expect(Number(response.body.data.refund.actual).toFixed(2)).toBe('250.00');

    const orderRows = await db.query(
      "SELECT status, to_char(check_out_date, 'YYYY-MM-DD') AS check_out_date, to_char(stay_date, 'YYYY-MM-DD') AS stay_date FROM orders WHERE order_id = $1 ORDER BY stay_date",
      [orderId]
    );
    expect(orderRows.rows.length).toBe(1);
    expect(orderRows.rows[0].status).toBe('checked-out');
    expect(orderRows.rows[0].check_out_date).toBe('2026-01-11');
    expect(orderRows.rows[0].stay_date).toBe('2026-01-10');

    const billRows = await db.query(
      'SELECT change_type, change_price FROM bills WHERE order_id = $1 ORDER BY bill_id DESC LIMIT 1',
      [orderId]
    );
    expect(billRows.rows[0].change_type).toBe('房费');
    expect(Number(billRows.rows[0].change_price).toFixed(2)).toBe('-250.00');

    const roomRows = await db.query('SELECT status FROM rooms WHERE room_number = $1', ['TEST_EC01']);
    expect(roomRows.rows[0].status).toBe('cleaning');
  });

  test('未入住退房时，应当取消订单、清零房费并把房间恢复为空闲', async () => {
    const orderId = `TEST_EC_CANCEL_${Date.now()}`;

    await createOrder({
      orderId,
      sourceNumber: '',
      orderSource: 'front_desk',
      guestName: '未入住退房测试客人',
      roomType: 'TEST_EC_ROOM',
      roomNumber: 'TEST_EC02',
      checkInDate: '2026-01-15',
      checkOutDate: '2026-01-17',
      status: 'checked-in',
      paymentMethod: '微信',
      phone: '',
      roomPrice: {
        '2026-01-15': 100,
        '2026-01-16': 120
      },
      deposit: 0,
      isPrepaid: false,
      prepaidAmount: 0,
      stayType: '客房',
      remarks: '未入住退房接口测试'
    });

    const response = await authedRequest()
      .post(`/api/orders/${orderId}/early-checkout`)
      .send({
        actualCheckoutTime: '2026-01-15T09:00',
        refundAmount: 100,
        refundMethod: '微信',
        hasStayed: false
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.cancelled).toBe(true);
    expect(Number(response.body.data.refund.actual).toFixed(2)).toBe('100.00');

    const orderRows = await db.query(
      'SELECT status, total_price FROM orders WHERE order_id = $1',
      [orderId]
    );
    expect(orderRows.rows.every(row => row.status === 'cancelled')).toBe(true);
    expect(orderRows.rows.every(row => Number(row.total_price) === 0)).toBe(true);

    const billRows = await db.query(
      'SELECT change_type, change_price FROM bills WHERE order_id = $1 ORDER BY bill_id DESC LIMIT 1',
      [orderId]
    );
    expect(billRows.rows[0].change_type).toBe('退款');
    expect(Number(billRows.rows[0].change_price).toFixed(2)).toBe('-100.00');

    const roomRows = await db.query('SELECT status FROM rooms WHERE room_number = $1', ['TEST_EC02']);
    expect(roomRows.rows[0].status).toBe('available');
  });
});
