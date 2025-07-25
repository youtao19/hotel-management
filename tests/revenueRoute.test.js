const request = require('supertest');
const app = require('../app');
const { query } = require('../backend/database/postgreDB/pg');

describe('Revenue Routes Tests', () => {
  const TEST_ROOM_TYPE = 'TEST_REVENUE_TYPE';

  beforeEach(async () => {
    // 使用全局清理函数
    await global.cleanupTestData();

    // 创建测试所需的房型数据
    await query(`
      INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
      VALUES ($1, '测试收入房型', 288.00, '测试房型', false)
      ON CONFLICT (type_code) DO NOTHING
    `, [TEST_ROOM_TYPE]);

    // 创建测试所需的房间数据
    const roomNumbers = ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '201', '202', '203', '204', '301'];
    for (let i = 0; i < roomNumbers.length; i++) {
      const roomNumber = roomNumbers[i];
      const roomId = 30000 + i; // 使用唯一的房间ID，避免冲突
      await query(`
        INSERT INTO rooms (room_id, room_number, type_code, status, price, is_closed)
        VALUES ($1, $2, $3, 'clean', 288.00, false)
        ON CONFLICT (room_number) DO UPDATE SET
        type_code = EXCLUDED.type_code, status = EXCLUDED.status, price = EXCLUDED.price
      `, [roomId, roomNumber, TEST_ROOM_TYPE]);
    }

    // 等待一小段时间确保数据库操作完成
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  // 创建测试订单和账单的辅助函数
  async function createTestOrderAndBill(orderId, roomNumber = '101', checkInDate = '2024-01-15', totalIncome = '500.00', payWay = '现金') {
    // 为每个测试用例生成唯一的订单ID（限制在20字符以内）
    const timestamp = Date.now().toString().slice(-6); // 取时间戳后6位
    const random = Math.random().toString(36).substr(2, 4); // 4位随机字符
    const uniqueOrderId = `${orderId.slice(0, 8)}_${timestamp}_${random}`.slice(0, 20); // 确保不超过20字符
    // 为每个测试用例生成唯一的客人信息
    const guestSuffix = random;
    const phoneNumber = `1380013${timestamp.slice(-4)}`; // 生成有效的11位电话号码
    const idNumber = `12345678901234567${timestamp.slice(-1)}`; // 生成有效的18位身份证号

    const orderData = {
      order_id: uniqueOrderId,
      order_source: 'front_desk',
      guest_name: `测试客人${guestSuffix}`,
      id_number: idNumber,
      phone: phoneNumber,
      room_type: TEST_ROOM_TYPE, // 使用测试房型
      room_number: roomNumber,
      check_in_date: `${checkInDate}T14:00:00.000Z`,
      check_out_date: `${checkInDate}T16:00:00.000Z`, // 修复：退房时间应该晚于入住时间
      status: 'pending', // 修复：使用有效的订单状态
      payment_method: 'cash',
      room_price: '400.00',
      deposit: '100.00',
      create_time: `${checkInDate}T10:00:00.000Z`,
      remarks: '测试订单'
    };

    const orderResponse = await request(app)
      .post('/api/orders/new')
      .send(orderData);

    // 检查订单创建是否成功
    if (orderResponse.status !== 201) {
      throw new Error(`Failed to create order: ${orderResponse.status} ${JSON.stringify(orderResponse.body)}`);
    }

    // 创建账单
    const billData = {
      order_id: uniqueOrderId,
      room_number: roomNumber,
      guest_name: `测试客人${guestSuffix}`,
      deposit: '100.00',
      refund_deposit: 'yes',
      room_fee: '400.00',
      total_income: totalIncome,
      pay_way: { value: payWay },
      remarks: '测试账单'
    };

    const billResponse = await request(app)
      .post('/api/bills/create')
      .send(billData);

    // 检查账单创建是否成功
    if (billResponse.status !== 201) {
      throw new Error(`Failed to create bill: ${billResponse.status} ${JSON.stringify(billResponse.body)}`);
    }

    return { order: orderResponse.body, bill: billResponse.body };
  }

  describe('GET /api/revenue/daily', () => {
    beforeEach(async () => {
      // 创建测试数据
      await createTestOrderAndBill('TEST001', '101', '2024-01-15', '500.00', '现金');
      await createTestOrderAndBill('TEST002', '102', '2024-01-15', '600.00', '微信');
      await createTestOrderAndBill('TEST003', '103', '2024-01-16', '700.00', '现金');
    });

    it('应该成功获取每日收入统计', async () => {
      const res = await request(app)
        .get('/api/revenue/daily')
        .query({
          startDate: '2024-01-15',
          endDate: '2024-01-16'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '获取每日收入统计成功');
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('period');
      expect(res.body.period.type).toBe('daily');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('缺少日期参数时应该返回400错误', async () => {
      const res = await request(app)
        .get('/api/revenue/daily')
        .query({
          startDate: '2024-01-15'
          // 缺少 endDate
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '请提供开始日期和结束日期');
    });

    it('日期格式错误时应该返回400错误', async () => {
      const res = await request(app)
        .get('/api/revenue/daily')
        .query({
          startDate: '2024/01/15', // 错误格式
          endDate: '2024-01-16'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '日期格式错误，请使用YYYY-MM-DD格式');
    });
  });

  describe('GET /api/revenue/weekly', () => {
    beforeEach(async () => {
      await createTestOrderAndBill('TEST004', '104', '2024-01-15', '800.00', '微信');
      await createTestOrderAndBill('TEST005', '105', '2024-01-22', '900.00', '现金');
    });

    it('应该成功获取每周收入统计', async () => {
      const res = await request(app)
        .get('/api/revenue/weekly')
        .query({
          startDate: '2024-01-15',
          endDate: '2024-01-25'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '获取每周收入统计成功');
      expect(res.body).toHaveProperty('data');
      expect(res.body.period.type).toBe('weekly');
    });

    it('缺少参数时应该返回400错误', async () => {
      const res = await request(app)
        .get('/api/revenue/weekly')
        .query({
          endDate: '2024-01-25'
          // 缺少 startDate
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'startDate and endDate are required');
    });
  });

  describe('GET /api/revenue/monthly', () => {
    beforeEach(async () => {
      await createTestOrderAndBill('TEST006', '106', '2024-01-15', '1000.00', '信用卡');
      await createTestOrderAndBill('TEST007', '107', '2024-02-15', '1100.00', '微邮付');
    });

    it('应该成功获取每月收入统计', async () => {
      const res = await request(app)
        .get('/api/revenue/monthly')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-02-28'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '获取每月收入统计成功');
      expect(res.body).toHaveProperty('data');
      expect(res.body.period.type).toBe('monthly');
    });
  });

  describe('GET /api/revenue/overview', () => {
    beforeEach(async () => {
      await createTestOrderAndBill('TEST008', '108', '2024-01-15', '1200.00', '现金');
      await createTestOrderAndBill('TEST009', '109', '2024-01-15', '1300.00', '微信');
    });

    it('应该成功获取收入概览统计', async () => {
      const res = await request(app)
        .get('/api/revenue/overview')
        .query({
          startDate: '2024-01-15',
          endDate: '2024-01-15'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '获取收入概览成功');
      expect(res.body).toHaveProperty('data');
      expect(res.body.period.type).toBe('overview');
    });
  });

  describe('GET /api/revenue/room-type', () => {
    beforeEach(async () => {
      await createTestOrderAndBill('TEST010', '110', '2024-01-15', '1400.00', '现金');
      await createTestOrderAndBill('TEST011', '111', '2024-01-15', '1500.00', '微信');
    });

    it('应该成功获取房型收入统计', async () => {
      const res = await request(app)
        .get('/api/revenue/room-type')
        .query({
          startDate: '2024-01-15',
          endDate: '2024-01-15'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '获取房型收入统计成功');
      expect(res.body).toHaveProperty('data');
      expect(res.body.period.type).toBe('room-type');
    });
  });

  describe('GET /api/revenue/quick-stats', () => {
    beforeEach(async () => {
      const today = new Date().toISOString().split('T')[0];
      await createTestOrderAndBill('TEST012', '112', today, '1600.00', '现金');
    });

    it('应该成功获取快速统计数据', async () => {
      const res = await request(app)
        .get('/api/revenue/quick-stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '获取快速统计数据成功');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('today');
      expect(res.body.data).toHaveProperty('thisWeek');
      expect(res.body.data).toHaveProperty('thisMonth');
      expect(res.body.data.today.period).toBe('today');
      expect(res.body.data.thisWeek.period).toBe('thisWeek');
      expect(res.body.data.thisMonth.period).toBe('thisMonth');
    });
  });

  // 测试错误处理
  describe('Error Handling', () => {
    it('所有路由在数据库错误时应该返回500', async () => {
      // 模拟数据库错误 - 使用无效的日期范围
      const invalidDate = '9999-99-99';

      const routes = [
        '/api/revenue/daily',
        '/api/revenue/weekly',
        '/api/revenue/monthly',
        '/api/revenue/overview',
        '/api/revenue/room-type'
      ];

      for (const route of routes) {
        const res = await request(app)
          .get(route)
          .query({
            startDate: invalidDate,
            endDate: invalidDate
          });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
      }
    });
  });

  // 测试数据验证和边界情况
  describe('Data Validation and Edge Cases', () => {
    it('应该正确处理空数据范围', async () => {
      const res = await request(app)
        .get('/api/revenue/daily')
        .query({
          startDate: '2030-01-01', // 未来日期，没有数据
          endDate: '2030-01-02'
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('应该正确处理开始日期晚于结束日期', async () => {
      const res = await request(app)
        .get('/api/revenue/daily')
        .query({
          startDate: '2024-01-20',
          endDate: '2024-01-15' // 结束日期早于开始日期
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('应该正确处理不同支付方式的统计', async () => {
      // 创建不同支付方式的测试数据
      await createTestOrderAndBill('TEST_CASH', '201', '2024-01-20', '500.00', '现金');
      await createTestOrderAndBill('TEST_WECHAT', '202', '2024-01-20', '600.00', '微信');
      await createTestOrderAndBill('TEST_ALIPAY', '203', '2024-01-20', '700.00', '微邮付');
      await createTestOrderAndBill('TEST_CREDIT', '204', '2024-01-20', '800.00', '信用卡');

      const res = await request(app)
        .get('/api/revenue/daily')
        .query({
          startDate: '2024-01-20',
          endDate: '2024-01-20'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);

      // 验证数据包含各种支付方式的统计
      const dayData = res.body.data[0];
      expect(dayData).toHaveProperty('cash_orders');
      expect(dayData).toHaveProperty('wechat_orders');
      expect(dayData).toHaveProperty('alipay_orders');
      expect(dayData).toHaveProperty('credit_card_orders');
      expect(dayData).toHaveProperty('cash_revenue');
      expect(dayData).toHaveProperty('wechat_revenue');
      expect(dayData).toHaveProperty('alipay_revenue');
      expect(dayData).toHaveProperty('credit_card_revenue');
    });

    it('快速统计应该包含正确的日期范围', async () => {
      const res = await request(app)
        .get('/api/revenue/quick-stats');

      expect(res.status).toBe(200);

      const today = new Date().toISOString().split('T')[0];
      expect(res.body.data.today.date).toBe(today);
      expect(res.body.data.thisWeek).toHaveProperty('startDate');
      expect(res.body.data.thisWeek).toHaveProperty('endDate');
      expect(res.body.data.thisMonth).toHaveProperty('startDate');
      expect(res.body.data.thisMonth).toHaveProperty('endDate');
    });

    it('应该正确处理特殊字符在日期参数中', async () => {
      const res = await request(app)
        .get('/api/revenue/daily')
        .query({
          startDate: '2024-01-15; DROP TABLE bills;', // SQL注入尝试
          endDate: '2024-01-16'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '日期格式错误，请使用YYYY-MM-DD格式');
    });

    it('应该正确处理超长日期字符串', async () => {
      const res = await request(app)
        .get('/api/revenue/daily')
        .query({
          startDate: '2024-01-15'.repeat(100), // 超长字符串
          endDate: '2024-01-16'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '日期格式错误，请使用YYYY-MM-DD格式');
    });
  });

  // 测试响应数据结构
  describe('Response Data Structure', () => {
    beforeEach(async () => {
      await createTestOrderAndBill('TEST_STRUCTURE', '301', '2024-01-25', '1000.00', '现金');
    });

    it('每日收入响应应该包含正确的数据结构', async () => {
      const res = await request(app)
        .get('/api/revenue/daily')
        .query({
          startDate: '2024-01-25',
          endDate: '2024-01-25'
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: '获取每日收入统计成功',
        data: expect.any(Array),
        period: {
          startDate: '2024-01-25',
          endDate: '2024-01-25',
          type: 'daily'
        }
      });

      if (res.body.data.length > 0) {
        const dayData = res.body.data[0];
        expect(dayData).toHaveProperty('date');
        expect(dayData).toHaveProperty('order_count');
        expect(dayData).toHaveProperty('total_revenue');
        expect(dayData).toHaveProperty('total_room_fee');
      }
    });

    it('房型收入响应应该包含正确的数据结构', async () => {
      const res = await request(app)
        .get('/api/revenue/room-type')
        .query({
          startDate: '2024-01-25',
          endDate: '2024-01-25'
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: '获取房型收入统计成功',
        data: expect.any(Array),
        period: {
          startDate: '2024-01-25',
          endDate: '2024-01-25',
          type: 'room-type'
        }
      });
    });

    it('收入概览响应应该包含正确的数据结构', async () => {
      const res = await request(app)
        .get('/api/revenue/overview')
        .query({
          startDate: '2024-01-25',
          endDate: '2024-01-25'
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: '获取收入概览成功',
        data: expect.any(Object), // getRevenueOverview 返回对象，不是数组
        period: {
          startDate: '2024-01-25',
          endDate: '2024-01-25',
          type: 'overview'
        }
      });

      // 验证对象的数据结构
      const overviewData = res.body.data;
      expect(overviewData).toHaveProperty('total_orders');
      expect(overviewData).toHaveProperty('total_revenue');
      expect(overviewData).toHaveProperty('avg_order_value');
      expect(overviewData).toHaveProperty('cash_orders');
      expect(overviewData).toHaveProperty('wechat_orders');
      expect(overviewData).toHaveProperty('alipay_orders');
      expect(overviewData).toHaveProperty('credit_card_orders');
    });
  });
});
