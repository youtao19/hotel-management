const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { addRoomType, addRoom } = require('./tools');

describe('订单修改接口集成测试', () => {
  const TEST_ROOM_TYPE = {
    type_code: 'ORDER_UPDATE_TYPE',
    type_name: '订单修改测试房型',
    base_price: 199.00,
    description: '用于订单更新流程的测试房型',
    is_closed: false
  };

  const TEST_ROOM = {
    room_number: 'ORDER_UPDATE_ROOM_01',
    type_code: TEST_ROOM_TYPE.type_code,
    status: 'available',
    price: 199.00,
    is_closed: false
  };

  const baseOrderPayload = {
    id_source: 'web',
    order_source: '测试渠道',
    guest_name: '原始住客',
    room_type: TEST_ROOM_TYPE.type_code,
    room_number: TEST_ROOM.room_number,
    check_in_date: '2025-12-01',
    check_out_date: '2025-12-03',
    status: 'reserved',
    payment_method: 'alipay',
    phone: '13800000000',
    total_price: {
      '2025-12-01': 199.00,
      '2025-12-02': 199.00
    },
    deposit: 200.00,
    stay_type: '客房',
    create_time: '2025-11-20T10:00:00Z',
    remarks: '原始备注'
  };

  let orderId;

  beforeAll(async () => {
    // 初始化测试所需房型与房间
    await query('DELETE FROM rooms WHERE room_number = $1', [TEST_ROOM.room_number]);
    await query('DELETE FROM room_types WHERE type_code = $1', [TEST_ROOM_TYPE.type_code]);
    await addRoomType([TEST_ROOM_TYPE]);
    await addRoom([TEST_ROOM]);
  });

  afterAll(async () => {
    // 清理测试过程中产生的订单及房源数据
    if (orderId) {
      await query('DELETE FROM order_changes WHERE order_id = $1', [orderId]);
      await query('DELETE FROM orders WHERE order_id = $1', [orderId]);
    }
    await query('DELETE FROM rooms WHERE room_number = $1', [TEST_ROOM.room_number]);
    await query('DELETE FROM room_types WHERE type_code = $1', [TEST_ROOM_TYPE.type_code]);
  });

  test('通过接口完成订单的创建、查询与修改', async () => {
    orderId = `ORDER_UPDATE_${Date.now()}`;
    const createPayload = {
      ...baseOrderPayload,
      order_id: orderId
    };

    // 步骤 1：调用创建接口生成测试订单
    const createResponse = await request(app)
      .post('/api/orders/new')
      .send(createPayload);

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.order.order_id).toBe(orderId);

    // 步骤 2：调用详情接口确认订单已存在
    const detailResponse = await request(app)
      .get(`/api/orders/${orderId}`);

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.body.data).toBeDefined();
    expect(detailResponse.body.data.order_id).toBe(orderId);

    const updatePayload = {
      total_price: 888.88,
      deposit: 150.00,
      payment_method: 'wechat_pay',
      reason: '集成测试修改订单'
    };

    // 步骤 3：调用修改接口更新订单关键信息
    const updateResponse = await request(app)
      .put(`/api/orders/${orderId}`)
      .send(updatePayload);

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.payment_method).toBe(updatePayload.payment_method);
    expect(parseFloat(updateResponse.body.data.total_price)).toBeCloseTo(updatePayload.total_price);
    expect(parseFloat(updateResponse.body.data.deposit)).toBeCloseTo(updatePayload.deposit);

    // 步骤 4：再次查询订单，确认所有修改生效
    const finalDetailResponse = await request(app)
      .get(`/api/orders/${orderId}`);

    expect(finalDetailResponse.statusCode).toBe(200);
    const updatedOrder = finalDetailResponse.body.data;
    expect(updatedOrder.payment_method).toBe(updatePayload.payment_method);
    expect(parseFloat(updatedOrder.total_price)).toBeCloseTo(updatePayload.total_price);
    expect(parseFloat(updatedOrder.deposit)).toBeCloseTo(updatePayload.deposit);
  });
});
