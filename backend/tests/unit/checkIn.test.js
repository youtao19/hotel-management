/**
 * 办理入住测试文件
 *
 * 测试接口：POST /api/orders/:orderId/check-in
 *
 * ✅ 核心功能说明：
 * 1. 办理入住（从待入住状态转为已入住状态）
 * 2. 插入每日房费账单（支持均分或自定义）
 * 3. 如果有押金，插入押金账单
 * 4. 更新订单状态为 'checked-in'
 * 5. 更新房间状态为 'occupied'
 * 6. 使用事务保证数据一致性
 *
 * ✅ 测试覆盖范围：
 * - ✅ 正常业务流程（有押金/无押金）
 * - ✅ 数据验证（订单存在性、订单状态）
 * - ✅ 业务规则（账单创建、状态更新）
 * - ✅ 错误处理（订单不存在、状态不正确）
 * - ✅ 事务完整性（所有操作原子性执行）
 *
 * 📊 相关数据库表：
 * - orders: 订单表
 *   - order_id: VARCHAR(50) PRIMARY KEY - 订单编号
 *   - status: VARCHAR(20) - 订单状态（必须为 'pending'）
 *   - room_number: VARCHAR(20) - 房间号
 *   - total_price: NUMERIC(10,2) - 总价
 *   - deposit: NUMERIC(10,2) - 押金
 * - bills: 账单表（插入房费和押金记录）
 *   - change_type: VARCHAR(20) - 账单类型（'房费' 或 '收押'）
 *   - change_price: NUMERIC(10,2) - 金额
 *   - stay_date: DATE - 住宿日期
 * - rooms: 房间表
 *   - status: VARCHAR(20) - 房间状态（更新为 'occupied'）
 *
 * 💡 业务规则说明：
 * 1. 只有状态为 'pending'（待入住）的订单可以办理入住
 * 2. 办理入住时插入每日房费账单（自动均分或使用自定义每日价格）
 * 3. 如果订单有押金（deposit > 0），插入押金账单
 * 4. 订单状态更新为 'checked-in'（已入住）
 * 5. 房间状态更新为 'occupied'（已入住）
 * 6. 所有操作在一个事务中执行，失败时回滚
 * 7. 账单的 stay_date 覆盖整个入住区间
 *
 */

const request = require('supertest');
const { query } = require('../../database/postgreDB/pg');
const app = require('../../app');
const { createTestRoomType, createTestRoom, createTestOrder } = require('../test-helpers');

describe('POST /api/orders/:orderId/check-in - 办理入住', () => {
  let testRoomType;
  let testRoom;

  beforeAll(async () => {
    // 创建测试房型和房间（在所有测试前创建一次）
    testRoomType = await createTestRoomType({ type_code: 'TEST_CHECKIN' });
    testRoom = await createTestRoom(testRoomType.type_code);
  });

  beforeEach(async () => {
    // 每个测试前清理数据
    await global.cleanupTestData();

    // 重新创建房型和房间（因为被清理了）
    testRoomType = await createTestRoomType({ type_code: 'TEST_CHECKIN' });
    testRoom = await createTestRoom(testRoomType.type_code);
  });

  describe('✅ 成功场景', () => {
    it('应成功办理入住（有押金，自动均分房费）', async () => {
      // 1. 创建待入住订单（两晚，自动均分房费）
      const testOrder = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom.room_number,
        check_in_date: '2025-10-15',
        check_out_date: '2025-10-17',
        status: 'pending',
        total_price: 600.00,
        deposit: 100.00,
        payment_method: 'cash'
      }, { insert: true });

      // 2. 办理入住
      const res = await request(app)
        .post(`/api/orders/${testOrder.order_id}/check-in`)
        .send();

      // 3. 验证响应
      if (res.status !== 200) {
        // eslint-disable-next-line no-console
        console.error('办理入住失败响应（有押金，均分）:', res.body);
      }
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: '办理入住成功'
      });
      expect(res.body.data).toBeDefined();
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.bills).toBeDefined();

      // 4. 验证订单状态已更新
      expect(res.body.data.order.status).toBe('checked-in');
      expect(res.body.data.order.order_id).toBe(testOrder.order_id);

      // 5. 验证生成了房费 + 押金账单
      const roomFeeBills = res.body.data.bills.filter(bill => bill.change_type === '房费');
      const depositBills = res.body.data.bills.filter(bill => bill.change_type === '收押');
      expect(roomFeeBills).toHaveLength(2);
      expect(depositBills).toHaveLength(1);

      // 6. 验证房费账单（均分为每天 300）
      const expectedDates = ['2025-10-15', '2025-10-16'];
      roomFeeBills.forEach((bill, index) => {
        expect(Number(bill.change_price)).toBeCloseTo(300.00, 2);
        expect(bill.order_id).toBe(testOrder.order_id);
        const stayDateStr = typeof bill.stay_date === 'string'
          ? bill.stay_date.split('T')[0]
          : bill.stay_date;
        expect(stayDateStr).toBe(expectedDates[index]);
      });

      // 7. 验证押金账单
      const depositBill = depositBills[0];
      expect(depositBill.change_type).toBe('收押');
      expect(Number(depositBill.change_price)).toBe(100.00);
      expect(depositBill.order_id).toBe(testOrder.order_id);

      // 8. 验证数据库中的订单状态
      const dbOrderResult = await query(
        'SELECT * FROM orders WHERE order_id = $1',
        [testOrder.order_id]
      );
      expect(dbOrderResult.rows[0].status).toBe('checked-in');

      // 9. 验证数据库中的账单
      const dbBillsResult = await query(
        'SELECT * FROM bills WHERE order_id = $1 ORDER BY create_time',
        [testOrder.order_id]
      );
      expect(dbBillsResult.rows).toHaveLength(3);
      const dbRoomFeeBills = dbBillsResult.rows.filter(row => row.change_type === '房费');
      expect(dbRoomFeeBills).toHaveLength(2);
      dbRoomFeeBills.forEach(row => {
        expect(Number(row.change_price)).toBeCloseTo(300.00, 2);
      });

      // 10. 验证房间状态已更新为已入住
      const dbRoomResult = await query(
        'SELECT * FROM rooms WHERE room_number = $1',
        [testRoom.room_number]
      );
      expect(dbRoomResult.rows[0].status).toBe('occupied');
    });

    it('应成功办理入住（无押金，自动均分房费）', async () => {
      // 1. 创建待入住订单（两晚，无押金）
      const testOrder = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom.room_number,
        check_in_date: '2025-10-15',
        check_out_date: '2025-10-17',
        status: 'pending',
        total_price: 500.00,
        deposit: 0, // 无押金
        payment_method: 'wechat'
      }, { insert: true });

      // 2. 办理入住
      const res = await request(app)
        .post(`/api/orders/${testOrder.order_id}/check-in`)
        .send();

      // 3. 验证响应
      if (res.status !== 200) {
        // eslint-disable-next-line no-console
        console.error('办理入住失败响应（无押金，均分）:', res.body);
      }
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: '办理入住成功'
      });

      // 4. 验证生成了 2 条房费账单（无押金）
      const roomFeeBills = res.body.data.bills.filter(bill => bill.change_type === '房费');
      expect(roomFeeBills).toHaveLength(2);
      roomFeeBills.forEach(bill => {
        expect(Number(bill.change_price)).toBeCloseTo(250.00, 2);
      });

      // 5. 验证数据库中只有房费账单
      const dbBillsResult = await query(
        'SELECT * FROM bills WHERE order_id = $1',
        [testOrder.order_id]
      );
      expect(dbBillsResult.rows).toHaveLength(2);
      dbBillsResult.rows.forEach(row => {
        expect(row.change_type).toBe('房费');
        expect(Number(row.change_price)).toBeCloseTo(250.00, 2);
      });
    });

    it('应支持自定义每日房价并更新押金', async () => {
      // 1. 创建待入住订单（两晚，押金暂为空）
      const testOrder = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom.room_number,
        check_in_date: '2025-10-20',
        check_out_date: '2025-10-22',
        status: 'pending',
        total_price: 450.00,
        deposit: null,
        payment_method: 'cash'
      }, { insert: true });

      const customPrices = [200, 250];
      const depositAmount = 180;

      // 2. 办理入住，传入自定义每日房价与押金
      const res = await request(app)
        .post(`/api/orders/${testOrder.order_id}/check-in`)
        .send({ deposit: depositAmount, dailyPrices: customPrices });

      // 3. 验证响应与账单
      if (res.status !== 200) {
        // eslint-disable-next-line no-console
        console.error('办理入住失败响应（自定义房价）:', res.body);
      }
      expect(res.status).toBe(200);
      const roomFeeBills = res.body.data.bills.filter(bill => bill.change_type === '房费');
      const depositBills = res.body.data.bills.filter(bill => bill.change_type === '收押');
      expect(roomFeeBills).toHaveLength(2);
      expect(depositBills).toHaveLength(1);
      expect(roomFeeBills.map(bill => Number(bill.change_price))).toEqual(customPrices);
      expect(Number(depositBills[0].change_price)).toBe(depositAmount);

      // 4. 验证数据库账单金额
      const dbBillsResult = await query(
        'SELECT change_type, change_price FROM bills WHERE order_id = $1 ORDER BY stay_date',
        [testOrder.order_id]
      );
      expect(dbBillsResult.rows).toHaveLength(3);
      const dbRoomFeePrices = dbBillsResult.rows
        .filter(row => row.change_type === '房费')
        .map(row => Number(row.change_price));
      expect(dbRoomFeePrices).toEqual(customPrices);

      // 5. 验证押金写回订单
      const orderResult = await query(
        'SELECT deposit FROM orders WHERE order_id = $1',
        [testOrder.order_id]
      );
      expect(Number(orderResult.rows[0].deposit)).toBe(depositAmount);
    });
  });

  describe('❌ 错误场景', () => {
    it('应拒绝不存在的订单', async () => {
      const res = await request(app)
        .post('/api/orders/NON_EXISTENT_ORDER/check-in')
        .send();

      if (res.status !== 404) {
        // eslint-disable-next-line no-console
        console.error('办理入住失败响应（不存在订单）:', res.body);
      }
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        message: '订单不存在'
      });
    });

    it('应拒绝状态不是待入住的订单（已入住）', async () => {
      // 1. 创建已入住订单
      const testOrder = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom.room_number,
        status: 'checked-in', // 已经是已入住状态
        total_price: 300.00,
        deposit: 100.00
      }, { insert: true });

      // 2. 尝试办理入住
      const res = await request(app)
        .post(`/api/orders/${testOrder.order_id}/check-in`)
        .send();

      // 3. 验证响应
      if (res.status !== 400) {
        // eslint-disable-next-line no-console
        console.error('办理入住失败响应（状态已入住）:', res.body);
      }
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false
      });
      expect(res.body.message).toContain('无法办理入住');
      expect(res.body.message).toContain('checked-in');
    });

    it('应拒绝状态不是待入住的订单（已退房）', async () => {
      // 1. 创建已退房订单
      const testOrder = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom.room_number,
        status: 'checked-out', // 已退房
        total_price: 300.00,
        deposit: 100.00
      }, { insert: true });

      // 2. 尝试办理入住
      const res = await request(app)
        .post(`/api/orders/${testOrder.order_id}/check-in`)
        .send();

      // 3. 验证响应
      if (res.status !== 400) {
        // eslint-disable-next-line no-console
        console.error('办理入住失败响应（状态已退房）:', res.body);
      }
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false
      });
      expect(res.body.message).toContain('无法办理入住');
    });

    it('应拒绝状态不是待入住的订单（已取消）', async () => {
      // 1. 创建已取消订单
      const testOrder = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom.room_number,
        status: 'cancelled', // 已取消
        total_price: 300.00,
        deposit: 100.00
      }, { insert: true });

      // 2. 尝试办理入住
      const res = await request(app)
        .post(`/api/orders/${testOrder.order_id}/check-in`)
        .send();

      // 3. 验证响应
      if (res.status !== 400) {
        // eslint-disable-next-line no-console
        console.error('办理入住失败响应（状态已取消）:', res.body);
      }
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('🔄 事务完整性测试', () => {
    it('验证账单字段完整性', async () => {
      // 1. 创建订单
      const testOrder = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom.room_number,
        check_in_date: '2025-10-15',
        check_out_date: '2025-10-17', // 2晚
        status: 'pending',
        total_price: 600.00, // 2晚总价
        deposit: 200.00,
        guest_name: '张三',
        payment_method: 'alipay',
        stay_type: '客房'
      }, { insert: true });

      // 2. 办理入住
      const res = await request(app)
        .post(`/api/orders/${testOrder.order_id}/check-in`)
        .send();

      expect(res.status).toBe(200);

      // 3. 验证账单的所有必要字段
      // 2晚订单应该有 2条房费 + 1条押金 = 3条账单
      expect(res.body.data.bills).toHaveLength(3);

      const roomFeeBills = res.body.data.bills.filter(b => b.change_type === '房费');
      const depositBills = res.body.data.bills.filter(b => b.change_type === '收押');

      expect(roomFeeBills).toHaveLength(2);
      expect(depositBills).toHaveLength(1);

      // 验证第一条房费账单
      const roomFeeBill = roomFeeBills[0];
      expect(roomFeeBill).toMatchObject({
        order_id: testOrder.order_id,
        room_number: String(testRoom.room_number).slice(0, 10), // room_number 会被截断
        guest_name: '张三',
        change_type: '房费',
        pay_way: 'alipay',
        stay_type: '客房'
      });
      expect(roomFeeBill.create_time).toBeDefined();
      expect(roomFeeBill.remarks).toBeDefined();

      // 验证押金账单
      const depositBill = depositBills[0];
      expect(depositBill).toMatchObject({
        order_id: testOrder.order_id,
        change_type: '收押',
        pay_way: 'alipay'
      });
    });

    it('验证多订单不互相影响', async () => {
      // 1. 创建第二个房间
      const testRoom2 = await createTestRoom(testRoomType.type_code);

      // 2. 创建两个订单
      const testOrder1 = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom.room_number,
        status: 'pending',
        total_price: 300.00,
        deposit: 100.00
      }, { insert: true });

      const testOrder2 = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom2.room_number,
        status: 'pending',
        total_price: 400.00,
        deposit: 150.00
      }, { insert: true });

      // 3. 只办理第一个订单的入住
      const res1 = await request(app)
        .post(`/api/orders/${testOrder1.order_id}/check-in`)
        .send();

      expect(res1.status).toBe(200);

      // 4. 验证第一个订单已入住
      const dbOrder1 = await query(
        'SELECT * FROM orders WHERE order_id = $1',
        [testOrder1.order_id]
      );
      expect(dbOrder1.rows[0].status).toBe('checked-in');

      // 5. 验证第二个订单仍然是待入住
      const dbOrder2 = await query(
        'SELECT * FROM orders WHERE order_id = $1',
        [testOrder2.order_id]
      );
      expect(dbOrder2.rows[0].status).toBe('pending');

      // 6. 验证第一个房间是 occupied，第二个房间是 available
      const dbRoom1 = await query(
        'SELECT * FROM rooms WHERE room_number = $1',
        [testRoom.room_number]
      );
      expect(dbRoom1.rows[0].status).toBe('occupied');

      const dbRoom2 = await query(
        'SELECT * FROM rooms WHERE room_number = $1',
        [testRoom2.room_number]
      );
      expect(dbRoom2.rows[0].status).toBe('available');
    });
  });

  describe('📝 业务逻辑验证', () => {
    it('验证账单金额正确性', async () => {
      const totalPrice = 588.88;
      const depositAmount = 200.00;

      const testOrder = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom.room_number,
        status: 'pending',
        total_price: totalPrice,
        deposit: depositAmount
      }, { insert: true });

      const res = await request(app)
        .post(`/api/orders/${testOrder.order_id}/check-in`)
        .send();

      expect(res.status).toBe(200);

      // 验证房费金额
      const roomFeeBill = res.body.data.bills.find(b => b.change_type === '房费');
      expect(Number(roomFeeBill.change_price)).toBeCloseTo(totalPrice, 2);

      // 验证押金金额
      const depositBill = res.body.data.bills.find(b => b.change_type === '收押');
      expect(Number(depositBill.change_price)).toBeCloseTo(depositAmount, 2);
    });

    it('验证账单日期覆盖住宿区间', async () => {
      const checkInDate = '2025-12-25';
      const checkOutDate = '2025-12-27'; // 2晚

      const testOrder = await createTestOrder({
        room_type: testRoomType.type_code,
        room_number: testRoom.room_number,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        status: 'pending',
        total_price: 600.00,
        deposit: 200.00
      }, { insert: true });

      const res = await request(app)
        .post(`/api/orders/${testOrder.order_id}/check-in`)
        .send();

      expect(res.status).toBe(200);

      // 验证房费账单的日期覆盖整个住宿区间
      const roomFeeBills = res.body.data.bills.filter(b => b.change_type === '房费');
      const depositBills = res.body.data.bills.filter(b => b.change_type === '收押');

      expect(roomFeeBills).toHaveLength(2); // 2晚 = 2条房费账单
      expect(depositBills).toHaveLength(1); // 1条押金账单

      // 验证房费账单日期：应该是 2025-12-25 和 2025-12-26
      const roomFeeDates = roomFeeBills.map(bill => {
        return typeof bill.stay_date === 'string'
          ? bill.stay_date.split('T')[0]
          : bill.stay_date;
      }).sort();

      expect(roomFeeDates).toEqual(['2025-12-25', '2025-12-26']);

      // 验证押金账单日期：应该是入住日期
      const depositDate = typeof depositBills[0].stay_date === 'string'
        ? depositBills[0].stay_date.split('T')[0]
        : depositBills[0].stay_date;

      expect(depositDate).toBe(checkInDate);
    });
  });
});
