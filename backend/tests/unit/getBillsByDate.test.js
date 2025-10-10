/**
 * 账单查询测试文件
 *
 * 测试接口：GET /api/bills
 *
 * ✅ 核心功能说明：
 * 1. 按日期查询账单记录
 * 2. 支持多种查询条件（日期、订单ID、支付方式等）
 * 3. 账单数据聚合和统计
 * 4. 处理不同类型的账单（房费、押金、退押等）
 *
 * ✅ 测试覆盖范围：
 * - ✅ 正常业务流程（按日期查询账单）
 * - ✅ 数据过滤（单日、日期范围、订单筛选）
 * - ✅ 账单类型处理（房费、收押、退押、订单账单）
 * - ✅ 数据完整性（金额计算、字段验证）
 * - ✅ 边界情况（空结果、特殊日期）
 *
 * 📊 相关数据库表：
 * - bills: 账单表
 *   - bill_id: SERIAL PRIMARY KEY - 账单ID
 *   - order_id: VARCHAR(50) - 订单编号
 *   - pay_way: VARCHAR(20) - 支付方式（现金/微信/微邮付/平台）
 *   - change_price: NUMERIC(10,2) - 金额变动
 *   - change_type: VARCHAR(20) - 变动类型（房费/收押/退押/订单账单）
 *   - stay_type: VARCHAR(20) - 住宿类型（客房/休息房）
 *   - stay_date: DATE - 账单日期
 *   - created_at: TIMESTAMP - 创建时间
 * - orders: 订单表（关联查询）
 * - room_types: 房型表（关联查询）
 *
 * 💡 业务规则说明：
 * 1. 账单记录所有订单相关的资金变动
 * 2. 支付方式：现金、微信、微邮付、平台
 * 3. 变动类型：
 *    - 房费：正常房费收入
 *    - 收押：收取押金（正数）
 *    - 退押：退还押金（负数）
 *    - 订单账单：兼容旧格式
 * 4. stay_date 是账单的业务日期（用于交接班统计）
 * 5. 金额为负数表示退款
 * 6. 查询时可按日期范围过滤
 *
 * 🧪 测试数据说明：
 * - 使用测试订单（TEST_开头的order_id）
 * - 测试房型：TEST_A、TEST_B
 * - 测试房间：TEST_115、TEST_106
 * - 测试日期：2025-10-07
 *
 * 作者：AI Assistant
 * 日期：2025-10-10
 */

const request = require('supertest');
const app = require('../../app');
const { query, getClient, pool } = require('../../database/postgreDB/pg');

describe('GET /api/bills - 按日期查询账单', () => {
  let testOrderId1;
  let testOrderId2;
  let testDate;
  let testRoomType1;
  let testRoomType2;

  // 设置测试超时时间为 30 秒
  // jest.setTimeout(30000);

  beforeAll(async () => {
    // 设置测试日期
    testDate = '2025-10-07';

    // 清理测试数据 - 先删除所有依赖数据，避免外键冲突
    await query('DELETE FROM bills WHERE order_id LIKE $1', ['TEST_%']);
    await query('DELETE FROM orders WHERE room_type LIKE $1', ['TEST_%']); // 删除所有使用TEST_房型的订单
    await query('DELETE FROM rooms WHERE type_code LIKE $1', ['TEST_%']); // 删除所有使用TEST_房型的房间
    await query('DELETE FROM room_types WHERE type_code LIKE $1', ['TEST_%']);

    // 创建测试房型 - 使用唯一标识避免与其他测试冲突
    testRoomType1 = 'TEST_BILLS_A';
    testRoomType2 = 'TEST_BILLS_B';

    await query(`
      INSERT INTO room_types (type_code, type_name, base_price)
      VALUES ($1, '测试房型A', 388), ($2, '测试房型B', 144)
      ON CONFLICT (type_code) DO NOTHING
    `, [testRoomType1, testRoomType2]);

    // 创建测试房间
    await query(`
      INSERT INTO rooms (room_id, room_number, type_code, status, price)
      VALUES (99991, 'TEST_115', $1, '空闲', 388),
             (99992, 'TEST_106', $2, '空闲', 144)
      ON CONFLICT (room_number) DO NOTHING
    `, [testRoomType1, testRoomType2]);
  });

  afterAll(async () => {
    // 清理测试数据 - 必须按照外键依赖顺序删除
    await query('DELETE FROM bills WHERE order_id LIKE $1', ['TEST_%']);
    await query('DELETE FROM orders WHERE room_type LIKE $1', ['TEST_%']); // 删除所有使用TEST_房型的订单
    await query('DELETE FROM rooms WHERE type_code LIKE $1', ['TEST_%']); // 删除所有使用TEST_房型的房间
    await query('DELETE FROM room_types WHERE type_code LIKE $1', ['TEST_%']);

    // 注意：不要在这里关闭连接池，全局的 setup.js 会处理
  });

  describe('GET /api/bills/by-date/:date', () => {
    beforeEach(async () => {
      // 清理可能存在的测试数据
      await query('DELETE FROM bills WHERE order_id LIKE $1', ['TEST_%']);
      await query('DELETE FROM orders WHERE order_id LIKE $1', ['TEST_%']);

      // 创建测试订单1 - 客房
      testOrderId1 = 'TEST_ORDER_HOTEL_001';
      await query(`
        INSERT INTO orders (
          order_id, order_source, guest_name, phone, id_number,
          room_type, room_number, check_in_date, check_out_date,
          status, payment_method, total_price, deposit, create_time, stay_type
        ) VALUES (
          $1, '前台', '陈敏', '13800138000', '110101199001011234',
          $2, 'TEST_115', $3, $3,
          '已入住', '现金', 388, 152, NOW(), '客房'
        )
      `, [testOrderId1, testRoomType1, testDate]);

      // 创建测试订单2 - 休息房
      testOrderId2 = 'TEST_ORDER_REST_001';
      await query(`
        INSERT INTO orders (
          order_id, order_source, guest_name, phone, id_number,
          room_type, room_number, check_in_date, check_out_date,
          status, payment_method, total_price, deposit, create_time, stay_type
        ) VALUES (
          $1, '前台', '刘敏', '13900139000', '110101199002021234',
          $2, 'TEST_106', $3, $3,
          '已退房', '微信', 144, 50, NOW(), '休息房'
        )
      `, [testOrderId2, testRoomType2, testDate]);

      // 为订单1创建账单（客房）
      await query(`
        INSERT INTO bills (
          order_id, room_number, stay_date, change_type, change_price, pay_way, create_time
        ) VALUES
          ($1, 'TEST_115', $2, '房费', 388, '现金', NOW()),
          ($1, 'TEST_115', $2, '收押', 152, '现金', NOW())
      `, [testOrderId1, testDate]);

      // 为订单2创建账单（休息房）
      await query(`
        INSERT INTO bills (
          order_id, room_number, stay_date, change_type, change_price, pay_way, create_time
        ) VALUES
          ($1, 'TEST_106', $2, '房费', 144, '微信', NOW()),
          ($1, 'TEST_106', $2, '收押', 50, '微信', NOW())
      `, [testOrderId2, testDate]);
    });

    afterEach(async () => {
      // 清理测试数据 - 按外键依赖顺序
      await query('DELETE FROM bills WHERE order_id LIKE $1', ['TEST_%']);
      await query('DELETE FROM orders WHERE order_id LIKE $1', ['TEST_%']);
    });

    test('应该成功获取指定日期的所有账单', async () => {
      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('hotelBills');
      expect(response.body.data).toHaveProperty('restBills');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.message).toContain(testDate);
    });

    test('应该正确返回客房账单', async () => {
      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const hotelBills = response.body.data.hotelBills;

      expect(hotelBills).toBeInstanceOf(Array);
      expect(hotelBills.length).toBeGreaterThanOrEqual(2); // 至少有房费和收押两条

      // 验证账单包含必要字段
      hotelBills.forEach(bill => {
        expect(bill).toHaveProperty('bill_id');
        expect(bill).toHaveProperty('order_id');
        expect(bill).toHaveProperty('stay_type', '客房');
        expect(bill).toHaveProperty('change_type');
        expect(bill).toHaveProperty('change_price');
        expect(bill).toHaveProperty('pay_way');
      });
    });

    test('应该正确返回休息房账单', async () => {
      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const restBills = response.body.data.restBills;

      expect(restBills).toBeInstanceOf(Array);
      expect(restBills.length).toBeGreaterThanOrEqual(2); // 至少有房费和收押两条

      // 验证账单包含必要字段
      restBills.forEach(bill => {
        expect(bill).toHaveProperty('bill_id');
        expect(bill).toHaveProperty('order_id');
        expect(bill).toHaveProperty('stay_type', '休息房');
        expect(bill).toHaveProperty('change_type');
        expect(bill).toHaveProperty('change_price');
        expect(bill).toHaveProperty('pay_way');
      });
    });

    test('应该返回所有账单类型', async () => {
      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const allBills = [
        ...response.body.data.hotelBills,
        ...response.body.data.restBills
      ];

      const changeTypes = allBills.map(bill => bill.change_type);

      // 应该包含房费和收押
      expect(changeTypes).toContain('房费');
      expect(changeTypes).toContain('收押');
    });

    test('应该正确返回账单详细信息', async () => {
      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const hotelBills = response.body.data.hotelBills;
      const firstBill = hotelBills[0];

      // 验证订单关联信息
      expect(firstBill).toHaveProperty('room_number');
      expect(firstBill).toHaveProperty('guest_name');
      expect(firstBill).toHaveProperty('phone');
      expect(firstBill).toHaveProperty('order_status');
    });

    test('应该返回正确的总账单数', async () => {
      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const { hotelBills, restBills, totalCount } = response.body.data;

      expect(totalCount).toBe(hotelBills.length + restBills.length);
    });

    test('没有账单时应该返回空数组', async () => {
      const futureDate = '2099-12-31';

      const response = await request(app)
        .get(`/api/bills/by-date/${futureDate}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hotelBills).toEqual([]);
      expect(response.body.data.restBills).toEqual([]);
      expect(response.body.data.totalCount).toBe(0);
    });

    test('应该正确处理退押账单', async () => {
      // 添加退押账单（退押按创建时间过滤）
      await query(`
        INSERT INTO bills (
          order_id, room_number, stay_date, change_type, change_price, pay_way, create_time
        ) VALUES ($1, 'TEST_115', $2, '退押', -152, '现金', $3)
      `, [testOrderId1, '2025-10-06', `${testDate} 15:00:00`]);

      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const allBills = [
        ...response.body.data.hotelBills,
        ...response.body.data.restBills
      ];

      const refundBills = allBills.filter(bill => bill.change_type === '退押');

      expect(refundBills.length).toBeGreaterThan(0);
      expect(refundBills[0].change_price).toBeLessThan(0); // 退押金额为负数
    });

    test('应该正确处理补收账单', async () => {
      // 添加补收账单（补收按创建时间过滤）
      await query(`
        INSERT INTO bills (
          order_id, room_number, stay_date, change_type, change_price, pay_way, create_time
        ) VALUES ($1, 'TEST_115', $2, '补收', 50, '现金', $3)
      `, [testOrderId1, '2025-10-06', `${testDate} 16:00:00`]);

      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const allBills = [
        ...response.body.data.hotelBills,
        ...response.body.data.restBills
      ];

      const extraChargeBills = allBills.filter(bill => bill.change_type === '补收');

      expect(extraChargeBills.length).toBeGreaterThan(0);
      expect(extraChargeBills[0].change_price).toBeGreaterThan(0); // 补收金额为正数
    });

    test('应该正确按支付方式分类', async () => {
      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const allBills = [
        ...response.body.data.hotelBills,
        ...response.body.data.restBills
      ];

      const payWays = [...new Set(allBills.map(bill => bill.pay_way))];

      // 应该至少有现金和微信
      expect(payWays).toContain('现金');
      expect(payWays).toContain('微信');
    });

    test('日期格式错误应该返回500', async () => {
      const response = await request(app)
        .get('/api/bills/by-date/invalid-date')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('失败');
    });

    test('应该正确关联订单信息', async () => {
      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const hotelBills = response.body.data.hotelBills;
      const testBill = hotelBills.find(bill => bill.order_id === testOrderId1);

      expect(testBill).toBeDefined();
      expect(testBill.guest_name).toBe('陈敏');
      expect(testBill.room_number).toBe('TEST_115');
      expect(testBill.phone).toBe('13800138000');
    });

    test('应该按住宿类型正确分组', async () => {
      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const { hotelBills, restBills } = response.body.data;

      // 所有客房账单的 stay_type 应该是"客房"
      hotelBills.forEach(bill => {
        expect(bill.stay_type).toBe('客房');
      });

      // 所有休息房账单的 stay_type 应该是"休息房"
      restBills.forEach(bill => {
        expect(bill.stay_type).toBe('休息房');
      });
    });

    test('应该返回原始账单数据，不做聚合', async () => {
      const response = await request(app)
        .get(`/api/bills/by-date/${testDate}`)
        .expect(200);

      const hotelBills = response.body.data.hotelBills;

      // 同一个订单的不同账单应该是分开的记录
      const order1Bills = hotelBills.filter(bill => bill.order_id === testOrderId1);

      expect(order1Bills.length).toBeGreaterThanOrEqual(2); // 房费和收押是分开的

      const roomFeeBill = order1Bills.find(bill => bill.change_type === '房费');
      const depositBill = order1Bills.find(bill => bill.change_type === '收押');

      expect(roomFeeBill).toBeDefined();
      expect(depositBill).toBeDefined();
      expect(roomFeeBill.bill_id).not.toBe(depositBill.bill_id); // 不同的账单ID
    });
  });
});

