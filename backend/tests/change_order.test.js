const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { addRoomType, addRoom,buildOrderPayload,roomTypes,rooms } = require('./tools');
const { createOrder } = require('../modules/orderModule');

describe('订单修改接口集成测试', () => {
  beforeAll(async () => {
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });

  test('通过接口完成订单的创建、查询与修改', async () => {
    const orderId = `ORDER_UPDATE_${Date.now()}`;
    const createPayload = buildOrderPayload({
      orderId
    });
    // 步骤 1：调用创建接口生成测试订单
    await createOrder(createPayload);

    // 步骤 2：调用详情接口确认订单已存在
    const detailResponse = await request(app)
      .get(`/api/orders/${orderId}`);

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.body.data).toBeDefined();
    // API now returns an array of rows (multi-day support)
    expect(Array.isArray(detailResponse.body.data)).toBe(true);
    expect(detailResponse.body.data[0].order_id).toBe(orderId);

    const updatePayload = {
      payment_method: 'wechat_pay',
      reason: '集成测试修改订单'
    };

    // 步骤 3：调用修改接口更新订单关键信息
    const updateResponse = await request(app)
      .put(`/api/orders/${orderId}`)
      .send(updatePayload);

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data[0].payment_method).toBe(updatePayload.payment_method);

    // 步骤 4：再次查询订单，确认所有修改生效
    const finalDetailResponse = await request(app)
      .get(`/api/orders/${orderId}`);

    expect(finalDetailResponse.statusCode).toBe(200);
    const updatedOrder = finalDetailResponse.body.data[0];
    expect(updatedOrder.payment_method).toBe(updatePayload.payment_method);
  });

  test('修改订单支持房费与押金多支付方式拆分', async () => {
    const orderId = `ORDER_UPDATE_SPLIT_${Date.now()}`;
    const createPayload = buildOrderPayload({
      orderId,
      roomType: 'asu_xiao_zhu',
      roomNumber: '102',
      checkInDate: '2025-12-10',
      checkOutDate: '2025-12-12',
      roomPrice: {
        '2025-12-10': 120,
        '2025-12-11': 180
      },
      paymentMethod: '现金',
      deposit: 0
    });
    await createOrder(createPayload);

    // 先办理入住，生成原始房费/押金账单。
    const checkInResponse = await request(app)
      .post(`/api/orders/${orderId}/check-in`)
      .send({ deposit: 100 });
    expect(checkInResponse.statusCode).toBe(200);

    const updateResponse = await request(app)
      .put(`/api/orders/${orderId}/with-bills-v2`)
      .send({
        orderData: {
          payment_method: '现金',
          deposit: 100,
          reason: '测试修改订单多支付方式'
        },
        roomPrice: {
          '2025-12-10': 150,
          '2025-12-11': 210
        },
        roomFeePaymentSplits: [
          { method: '现金', amount: 140 },
          { method: '微信', amount: 220 }
        ],
        depositPaymentSplits: [
          { method: '微信', amount: 30 },
          { method: '微邮付', amount: 70 }
        ],
        depositPaymentMethod: '微信',
        changedBy: 'integration-test'
      });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.success).toBe(true);

    const roomFeeGrouped = await query(
      `SELECT pay_way, SUM(change_price) AS total
         FROM bills
        WHERE order_id = $1
          AND change_type = '房费'
        GROUP BY pay_way`,
      [orderId]
    );
    const roomFeeMap = Object.fromEntries(
      roomFeeGrouped.rows.map((row) => [row.pay_way, Number(row.total)])
    );
    expect(roomFeeMap['现金']).toBeCloseTo(140, 5);
    expect(roomFeeMap['微信']).toBeCloseTo(220, 5);

    const depositGrouped = await query(
      `SELECT pay_way, SUM(change_price) AS total
         FROM bills
        WHERE order_id = $1
          AND change_type = '收押'
        GROUP BY pay_way`,
      [orderId]
    );
    const depositMap = Object.fromEntries(
      depositGrouped.rows.map((row) => [row.pay_way, Number(row.total)])
    );
    expect(depositMap['微信']).toBeCloseTo(30, 5);
    expect(depositMap['微邮付']).toBeCloseTo(70, 5);

    const updatedOrderRows = await query(
      `SELECT payment_method
         FROM orders
        WHERE order_id = $1
        ORDER BY stay_date`,
      [orderId]
    );
    expect(updatedOrderRows.rows[0].payment_method).toBe('混合支付');
  });
});
