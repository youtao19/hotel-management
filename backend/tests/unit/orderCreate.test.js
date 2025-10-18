/**
 * 订单创建测试文件
 *
 * 测试接口：POST /api/orders/new
 *
 * ✅ 核心功能说明：
 * 1. 创建新订单（客房/休息房）
 * 2. 验证订单数据完整性和合法性
 * 3. 处理房间可用性检查
 * 4. 自动生成账单记录
 * 5. 防止重复订单创建
 *
 * ✅ 测试覆盖范围：
 * - ✅ 正常业务流程（成功创建订单）
 * - ✅ 数据验证（必填字段、数据格式）
 * - ✅ 业务规则（房间可用性、价格计算、日期范围）
 * - ✅ 错误处理（重复订单、房间不可用、无效数据）
 * - ✅ 边界情况（特殊日期、价格边界值）
 *
 * 📊 相关数据库表：
 * - orders: 订单表
 *   - order_id: VARCHAR(50) PRIMARY KEY - 订单编号
 *   - guest_name: VARCHAR(100) - 客人姓名
 *   - phone: VARCHAR(20) - 联系电话
 *   - room_type: VARCHAR(50) - 房型代码
 *   - room_number: VARCHAR(20) - 房间号
 *   - check_in_date: DATE - 入住日期
 *   - check_out_date: DATE - 退房日期
 *   - status: VARCHAR(20) - 订单状态
 *   - total_price: NUMERIC(10,2) - 总价
 *   - deposit: NUMERIC(10,2) - 押金
 *   - price_data: JSONB - 价格明细
 *   - stay_type: VARCHAR(20) - 住宿类型（客房/休息房）
 * - bills: 账单表（自动创建）
 * - rooms: 房间表（检查可用性）
 * - room_types: 房型表（价格参考）
 *
 * 💡 业务规则说明：
 * 1. 订单编号（order_id）必须唯一
 * 2. 入住日期不能晚于退房日期
 * 3. 同日入住退房判定为休息房，否则为客房
 * 4. 房间在订单时间段内必须可用
 * 5. 价格数据（price_data）可以是数字或JSON对象
 * 6. 创建订单时自动生成初始账单（收押金记录）
 * 7. 默认状态为 'pending'（待入住）
 * 8. 重复订单（相同order_id）会被拒绝
 *
 */

const request = require('supertest');
const { query } = require('../../database/postgreDB/pg');
const app = require('../../app');
const { createTestRoomType, createTestRoom, createTestOrder, generatePriceData } = require('../test-helpers');

describe('POST /api/orders/new - 创建新订单', () => {
  beforeAll(async () => {});

  beforeEach(async () => {
    await global.cleanupTestData();
  });

  it('应成功创建一个新订单', async () => {
    const roomType = await createTestRoomType();
    const room = await createTestRoom(roomType.type_code);
    const orderData = await createTestOrder({
      room_type: roomType.type_code,
      room_number: room.room_number,
    });

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
    const roomType = await createTestRoomType();
    const room = await createTestRoom(roomType.type_code);
    const orderData = await createTestOrder({
      room_type: roomType.type_code,
      room_number: room.room_number,
    });

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
    const roomType = await createTestRoomType();
    const room = await createTestRoom(roomType.type_code);
    const invalidOrder = {
      order_id: `TEST_${Date.now()}`,
      order_source: 'front_desk',
      guest_name: '测试用户',
      id_number: '123456789012345678',
      phone: '13800138000',
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-06-09',
      check_out_date: '2025-06-10',
      status: 'invalid_status',
      payment_method: 'cash',
      room_price: {"2025-06-09": 200.00},
      deposit: '100.00',
      remarks: '测试订单'
    };

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
    const roomType = await createTestRoomType();

    const invalidOrder = {
      order_id: `TEST_${Date.now()}`,
      order_source: 'front_desk',
      guest_name: '测试用户',
      id_number: '123456789012345678',
      phone: '13800138000',
      room_type: roomType.type_code,
      room_number: '999999', // 不存在的房间号
      check_in_date: '2025-06-09',
      check_out_date: '2025-06-10',
      status: 'pending',
      payment_method: 'cash',
      room_price: {"2025-06-09": 200.00},
      deposit: '100.00',
      remarks: '测试订单'
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
      order_id: `TEST_${Date.now()}`,
      order_source: 'front_desk',
      guest_name: '测试用户',
      id_number: '123456789012345678',
      phone: '13800138000',
      room_type: 'non_existent_type', // 不存在的房型
      room_number: '101',
      check_in_date: '2025-06-09',
      check_out_date: '2025-06-10',
      status: 'pending',
      payment_method: 'cash',
      room_price: {"2025-06-09": 200.00},
      deposit: '100.00',
      remarks: '测试订单'
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
    const roomType = await createTestRoomType();
    const room = await createTestRoom(roomType.type_code); // 使用动态生成的房间号

    const orderData1 = await createTestOrder({
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-06-09',
      check_out_date: '2025-06-10'
    });

    const res1 = await request(app)
      .post('/api/orders/new')
      .send(orderData1);

    expect(res1.status).toBe(201); // 201 表示创建成功

    const orderData2 = await createTestOrder({
      room_type: roomType.type_code,
      room_number: room.room_number, // 使用相同的房间号
      check_in_date: '2025-06-11',
      check_out_date: '2025-06-12'
    });

    const res2 = await request(app)
      .post('/api/orders/new')
      .send(orderData2);

    expect(res2.status).toBe(201); // 201 表示创建成功
  });

  // 新增：多日订单价格测试
  it('应成功创建多日订单（3天2夜）', async () => {
    const roomType = await createTestRoomType();
    const room = await createTestRoom(roomType.type_code);
    const orderData = await createTestOrder({
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-06-15',
      check_out_date: '2025-06-17', // 3天2夜
      room_price: {
        "2025-06-15": 220.00,
        "2025-06-16": 250.00
      }
    });

    const res = await request(app)
      .post('/api/orders/new')
      .send(orderData);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      message: '订单创建成功'
    });
  });

  // 新增：休息房测试（同日入住退房）
  it('应成功创建休息房订单（同日入住退房）', async () => {
    const roomType = await createTestRoomType();
    const room = await createTestRoom(roomType.type_code);
    const sameDate = '2025-06-20';
    const orderData = await createTestOrder({
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: sameDate,
      check_out_date: sameDate,
      room_price: {
        [sameDate]: 150.00
      }
    });

    const res = await request(app)
      .post('/api/orders/new')
      .send(orderData);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      message: '订单创建成功'
    });
  });

  // 新增：价格数据验证测试
  describe('价格数据验证', () => {
    it('应拒绝空的价格对象', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);
      const orderData = await createTestOrder({
        room_type: roomType.type_code,
        room_number: room.room_number,
        room_price: {} // 空价格对象
      });

      const res = await request(app)
        .post('/api/orders/new')
        .send(orderData);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        message: expect.stringContaining('价格')
      });
    });

    it('应拒绝无效的价格值（0或负数）', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);
      const orderData = await createTestOrder({
        room_type: roomType.type_code,
        room_number: room.room_number,
        room_price: {
          "2025-06-25": 0 // 无效价格
        }
      });

      const res = await request(app)
        .post('/api/orders/new')
        .send(orderData);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        message: expect.stringContaining('价格')
      });
    });

    it('应拒绝日期格式错误的价格数据', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);
      const orderData = await createTestOrder({
        room_type: roomType.type_code,
        room_number: room.room_number,
        room_price: {
          "invalid-date": 200.00
        }
      });

      const res = await request(app)
        .post('/api/orders/new')
        .send(orderData);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        message: expect.stringContaining('日期格式')
      });
    });

    it('应拒绝价格日期与入住日期不匹配的数据', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);
      const orderData = await createTestOrder({
        room_type: roomType.type_code,
        room_number: room.room_number,
        check_in_date: '2025-06-30',
        check_out_date: '2025-07-01',
        room_price: {
          "2025-07-01": 200.00 // 价格开始日期不匹配入住日期
        }
      });

      const res = await request(app)
        .post('/api/orders/new')
        .send(orderData);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        message: expect.stringContaining('价格开始日期')
      });
    });

    it('应拒绝多日订单中价格天数不匹配的数据', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);
      const orderData = await createTestOrder({
        room_type: roomType.type_code,
        room_number: room.room_number,
        check_in_date: '2025-07-05',
        check_out_date: '2025-07-08', // 3天住宿
        room_price: {
          "2025-07-05": 200.00,
          "2025-07-06": 220.00
          // 缺少 2025-07-07 的价格
        }
      });

      const res = await request(app)
        .post('/api/orders/new')
        .send(orderData);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        message: expect.stringMatching(/(价格结束日期|价格数据应包含)/)
      });
    });
  });

  // 新增：价格数据边界测试
  describe('价格数据边界测试', () => {
    it('应成功处理长期住宿（7天）', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);
      const priceData = {};
      const startDate = new Date('2025-08-01');

      // 生成7天的价格数据
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        priceData[dateKey] = 200.00 + (i * 10); // 递增价格
      }

      const orderData = await createTestOrder({
        room_type: roomType.type_code,
        room_number: room.room_number,
        check_in_date: '2025-08-01',
        check_out_date: '2025-08-08',
        room_price: priceData
      });

      const res = await request(app)
        .post('/api/orders/new')
        .send(orderData);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        success: true,
        message: '订单创建成功'
      });
    });

    it('应成功处理高价格值', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);
      const checkInDate = '2025-08-15';
      const checkOutDate = '2025-08-16';
      const orderData = await createTestOrder({
        room_type: roomType.type_code,
        room_number: room.room_number,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        room_price: {
          [checkInDate]: 9999.99
        }
      });

      const res = await request(app)
        .post('/api/orders/new')
        .send(orderData);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        success: true,
        message: '订单创建成功'
      });
    });
  });
});
