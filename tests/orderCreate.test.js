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

  // 创建测试房型和房间的辅助函数
  async function createTestRoomType(typeCode = 'TEST_STANDARD') {
    try {
      const result = await query(
        `INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (type_code) DO NOTHING RETURNING *`,
        [typeCode, '测试标准房', '200.00', '测试用房型', false]
      );
      console.log(`创建房型: ${typeCode}`, result.rows.length > 0 ? '成功' : '已存在');
    } catch (error) {
      console.error(`创建房型失败: ${typeCode}`, error.message);
      throw error;
    }
  }

  async function createTestRoom(roomNumber, typeCode = 'TEST_STANDARD') {
    try {
      // 生成一个唯一的room_id
      const roomId = parseInt(roomNumber) + 10000; // 确保不与现有房间冲突

      const result = await query(
        `INSERT INTO rooms (room_id, room_number, type_code, status, price, is_closed)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (room_number) DO UPDATE SET
         type_code = EXCLUDED.type_code, status = EXCLUDED.status, price = EXCLUDED.price
         RETURNING *`,
        [roomId, roomNumber, typeCode, 'available', '200.00', false]
      );
      console.log(`创建房间: ${roomNumber}`, result.rows.length > 0 ? '成功' : '更新');
    } catch (error) {
      console.error(`创建房间失败: ${roomNumber}`, error.message);
      throw error;
    }
  }

  // 定义一个有效的订单对象作为基准数据
  const validOrder = {
    order_id: 'TEST_ORDER',
    order_source: 'front_desk',
    guest_name: '测试用户',
    id_number: '123456789012345678',
    phone: '13800138000',
    room_type: 'TEST_STANDARD', // 使用测试房型
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
  async function generateOrderData(overrides = {}) {
    const timestamp = new Date().getTime();
    const orderData = {
      ...validOrder,
      order_id: `TEST_${timestamp}`,
      create_time: new Date().toISOString(),
      ...overrides
    };

    // 确保房型和房间存在
    const typeCode = orderData.room_type;
    const roomNumber = orderData.room_number;

    await createTestRoomType(typeCode);
    await createTestRoom(roomNumber, typeCode);

    // 等待一小段时间确保创建完成
    await new Promise(resolve => setTimeout(resolve, 100));

    return orderData;
  }

  it('应成功创建一个新订单', async () => {
    const orderData = await generateOrderData();
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
    const orderData = await generateOrderData();

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
    const invalidOrder = await generateOrderData({
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
    // 创建房型但不创建房间，这样可以测试房间不存在的情况
    const typeCode = 'TEST_STANDARD';
    await createTestRoomType(typeCode);

    const invalidOrder = {
      ...validOrder,
      order_id: `TEST_${Date.now()}`,
      room_type: typeCode,
      room_number: '999999', // 不存在的房间号
      create_time: new Date().toISOString()
    };

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
    // 直接使用不存在的房型，不预先创建
    const invalidOrder = {
      ...validOrder,
      order_id: `TEST_${Date.now()}`,
      room_type: 'non_existent_type', // 不存在的房型
      create_time: new Date().toISOString()
    };

    const res = await request(app) // 发送请求
      .post('/api/orders/new')
      .send(invalidOrder);

    expect(res.status).toBe(400); // 400 表示请求错误
    expect(res.body).toMatchObject({ // 检查响应体是否包含错误信息
      success: false,
      message: expect.stringContaining('房型')
    });
  });


it('创建同一房间不同时间的订单', async () => {
    const orderData1 = await generateOrderData({
      room_number: '305',
      check_in_date: '2025-06-09',
      check_out_date: '2025-06-10'
    });

    const res1 = await request(app)
      .post('/api/orders/new')
      .send(orderData1);

    expect(res1.status).toBe(201); // 201 表示创建成功

    const orderData2 = await generateOrderData({
      room_number: '305',
      check_in_date: '2025-06-11',
      check_out_date: '2025-06-12'
    });

    const res2 = await request(app)
      .post('/api/orders/new')
      .send(orderData2);

    expect(res2.status).toBe(201); // 201 表示创建成功
  });


});
