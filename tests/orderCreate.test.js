const request = require('supertest');
const { initializeHotelDB, closePool, query } = require('../backend/database/postgreDB/pg');
const app = require('../app');

describe('POST /api/orders/new', () => {
  beforeAll(async () => {
    await initializeHotelDB();
  });

  beforeEach(async () => {
    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE $1', ['TEST_%']);
  });

  afterAll(async () => {
    await query('DELETE FROM orders WHERE order_id LIKE $1', ['TEST_%']);
    await closePool();
  });

  // 定义一个有效的订单对象作为基准数据
  const validOrder = {
    order_id: 'TEST_ORDER',
    order_source: 'front_desk',
    guest_name: '测试用户',
    id_number: '123456789012345678',
    phone: '13800138000',
    room_type: 'standard',
    room_number: '101',
    check_in_date: '2025-06-09',
    check_out_date: '2025-06-10',
    status: 'pending',
    payment_method: 'cash',
    room_price: '200.00',
    deposit: '100.00',
    remarks: '测试订单'
  };

  // 生成测试订单数据的辅助函数
  function generateOrderData(overrides = {}) {
    const timestamp = new Date().getTime();
    return {
      ...validOrder,
      order_id: `TEST_${timestamp}`,
      create_time: new Date().toISOString(),
      ...overrides
    };
  }

  it('应成功创建一个新订单', async () => {
    const orderData = generateOrderData();
    const res = await request(app)
      .post('/api/orders/new')
      .send(orderData);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      message: '订单创建成功',
      data: {
        order: expect.objectContaining({
          order_id: orderData.order_id,
          guest_name: orderData.guest_name
        })
      }
    });
  });

  it('应正确处理重复订单', async () => {
    const orderData = generateOrderData();

    // 第一次创建订单
    await request(app)
      .post('/api/orders/new')
      .send(orderData);

    // 尝试创建相同的订单
    const res = await request(app)
      .post('/api/orders/new')
      .send(orderData);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      message: '相同订单已存在'
    });
  });

  test('应验证必填字段', async () => {
    const res = await request(app)
      .post('/api/orders/new')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('缺少必填字段')
    });
  });

  test('应验证订单状态字段', async () => {
    const invalidOrder = generateOrderData({
      status: 'invalid_status'
    });

    const res = await request(app)
      .post('/api/orders/new')
      .send(invalidOrder);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('无效的订单状态')
    });
  });

  test('应验证房间号是否存在', async () => {
    const invalidOrder = generateOrderData({
      room_number: '999999'
    });

    const res = await request(app)
      .post('/api/orders/new')
      .send(invalidOrder);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('房间号')
    });
  });

  test('应验证房型是否存在', async () => {
    const invalidOrder = generateOrderData({
      room_type: 'non_existent_type'
    });

    const res = await request(app)
      .post('/api/orders/new')
      .send(invalidOrder);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('房型')
    });
  });

  test('应验证入住日期在退房日期之前', async () => {
    const invalidOrder = generateOrderData({
      check_in_date: '2025-06-09',
      check_out_date: '2025-06-08'
    });

    const res = await request(app)
      .post('/api/orders/new')
      .send(invalidOrder);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('入住日期必须早于退房日期')
    });
  });
});
