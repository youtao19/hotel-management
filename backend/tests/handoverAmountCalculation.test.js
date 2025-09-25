/**
 * 交接班金额计算测试案例
 *
 * 这个文件包含各种真实场景的交接班金额计算测试，帮助验证金额计算的正确性。
 *
 * 计算公式：
 * 1. 备用金 = 前一日各支付方式的交接款
 * 2. 总收入 = 客房收入 + 休息房收入 + 租车收入 + 备用金
 * 3. 交接款 = 总收入 - 客房退押 - 休息房退押 - 留存款
 * 4. 现金留存款固定为320元
 */

const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('./test-helpers');

// 不使用 mock，而是真实测试计算逻辑
describe('交接班金额计算测试案例', () => {

  beforeEach(async () => {
    // 清理测试数据
    if (global.cleanupTestData) {
      await global.cleanupTestData();
    }
  });

  /**
   * 测试案例1：简单的单笔交易
   * 场景：一天只有一笔客房订单，现金支付
   */
  describe('案例1：简单单笔交易', () => {
    it('应该正确计算单笔现金客房订单的金额', async () => {
      const testDate = '2024-01-01';
      const prevDate = '2023-12-31';

      // 1. 准备前一天的交接款数据（作为今天的备用金）
      await query(`
        INSERT INTO handover (date, payment_type, handover, handover_person, takeover_person) VALUES
        ('${prevDate}', 1, 500, '测试交班人', '测试接班人'),  -- 现金交接款500
        ('${prevDate}', 2, 800, '测试交班人', '测试接班人'),  -- 微信交接款800
        ('${prevDate}', 3, 200, '测试交班人', '测试接班人'),  -- 微邮付交接款200
        ('${prevDate}', 4, 100, '测试交班人', '测试接班人')   -- 其他交接款100
      `);

      // 2. 创建测试房型和房间
      const roomType = await createTestRoomType({
        type_code: 'STANDARD',
        base_price: '288.00'
      });
      const room = await createTestRoom(roomType.type_code, {
        room_number: '101'
      });

      // 3. 创建订单（插入到数据库）
      const order = await createTestOrder({
        room_number: room.room_number,
        room_type: roomType.type_code,
        check_in_date: testDate,
        check_out_date: '2024-01-02',
        total_price: 400,
        deposit: 100
      }, { insert: true });

      // 4. 创建账单记录
      await query(`
        INSERT INTO bills (order_id, room_number, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date, create_time)
        VALUES ($1, $2, '现金', 400, '订单账单', 100, '客房', 300, $3, NOW())
      `, [order.order_id, room.room_number, testDate]);

      // 5. 调用API获取计算结果
      const res = await request(app)
        .get(`/api/handover/table?date=${testDate}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;

      // 验证备用金（来自前一天的交接款）
      expect(data.reserve).toEqual({
        '现金': 500,
        '微信': 800,
        '微邮付': 200,
        '其他': 100
      });

      // 验证客房收入（房费300 + 押金100 = 400）
      expect(data.hotelIncome).toEqual({
        '现金': 400,
        '微信': 0,
        '微邮付': 0,
        '其他': 0
      });

      // 验证总收入（客房收入400 + 备用金500 = 900现金，其他保持不变）
      expect(data.totalIncome).toEqual({
        '现金': 900,  // 400 + 500
        '微信': 800,
        '微邮付': 200,
        '其他': 100
      });

      // 验证交接款（总收入 - 退押 - 留存款320）
      expect(data.handoverAmount).toEqual({
        '现金': 580,  // 900 - 0 - 320
        '微信': 800,
        '微邮付': 200,
        '其他': 100
      });
    });
  });

  /**
   * 测试案例2：多种支付方式混合
   * 场景：同一天有多笔订单，使用不同支付方式
   */
  describe('案例2：多种支付方式混合', () => {
    it('应该正确处理多种支付方式的订单', async () => {
      const testDate = '2024-01-02';
      const prevDate = '2024-01-01';

      // 1. 准备前一天的交接款（较小金额）
      await query(`
        INSERT INTO handover (date, payment_type, handover, handover_person, takeover_person) VALUES
        ('${prevDate}', 1, 200, '测试交班人', '测试接班人'),  -- 现金
        ('${prevDate}', 2, 300, '测试交班人', '测试接班人'),  -- 微信
        ('${prevDate}', 3, 100, '测试交班人', '测试接班人'),  -- 微邮付
        ('${prevDate}', 4, 50, '测试交班人', '测试接班人')    -- 其他
      `);

      // 2. 创建测试数据
      const roomType = await createTestRoomType({
        type_code: 'DELUXE',
        base_price: '388.00'
      });

      const room1 = await createTestRoom(roomType.type_code, { room_number: '201' });
      const room2 = await createTestRoom(roomType.type_code, { room_number: '202' });
      const room3 = await createTestRoom(roomType.type_code, { room_number: '203' });

      // 3. 创建多个订单
      const order1 = await createTestOrder({
        room_number: room1.room_number,
        room_type: roomType.type_code,
        check_in_date: testDate,
        total_price: 500,
        deposit: 100
      }, { insert: true });

      const order2 = await createTestOrder({
        room_number: room2.room_number,
        room_type: roomType.type_code,
        check_in_date: testDate,
        total_price: 300,
        deposit: 50
      }, { insert: true });

      const order3 = await createTestOrder({
        room_number: room3.room_number,
        room_type: roomType.type_code,
        check_in_date: testDate,
        total_price: 600,
        deposit: 150
      }, { insert: true });

      // 4. 创建不同支付方式的账单
      await query(`
        INSERT INTO bills (order_id, room_number, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date, create_time) VALUES
        ($1, $5, '现金', 500, '订单账单', 100, '客房', 400, $4, NOW()),
        ($2, $6, '微信', 300, '订单账单', 50, '休息房', 250, $4, NOW()),
        ($3, $7, '微邮付', 600, '订单账单', 150, '客房', 450, $4, NOW())
      `, [order1.order_id, order2.order_id, order3.order_id, testDate, room1.room_number, room2.room_number, room3.room_number]);

      // 5. 获取计算结果
      const res = await request(app)
        .get(`/api/handover/table?date=${testDate}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // 验证客房收入和休息房收入分别计算
      expect(data.hotelIncome).toEqual({
        '现金': 500,  // 订单1
        '微信': 0,
        '微邮付': 600,  // 订单3
        '其他': 0
      });

      expect(data.restIncome).toEqual({
        '现金': 0,
        '微信': 300,  // 订单2
        '微邮付': 0,
        '其他': 0
      });

      // 验证总收入
      expect(data.totalIncome).toEqual({
        '现金': 700,  // 500 + 200(备用金)
        '微信': 600,  // 300 + 300(备用金)
        '微邮付': 700,  // 600 + 100(备用金)
        '其他': 50   // 0 + 50(备用金)
      });

      // 验证交接款
      expect(data.handoverAmount).toEqual({
        '现金': 380,  // 700 - 320(留存款)
        '微信': 600,
        '微邮付': 700,
        '其他': 50
      });
    });
  });

  /**
   * 测试案例3：包含退押金的复杂场景
   * 场景：有收入也有退押金，测试退押金对交接款的影响
   */
  describe('案例3：包含退押金的复杂场景', () => {
    it('应该正确处理退押金对交接款的影响', async () => {
      const testDate = '2024-01-03';
      const prevDate = '2024-01-02';

      // 1. 设置前一天交接款
      await query(`
        INSERT INTO handover (date, payment_type, handover, handover_person, takeover_person) VALUES
        ('${prevDate}', 1, 1000, '测试交班人', '测试接班人'),
        ('${prevDate}', 2, 500, '测试交班人', '测试接班人'),
        ('${prevDate}', 3, 0, '测试交班人', '测试接班人'),
        ('${prevDate}', 4, 0, '测试交班人', '测试接班人')
      `);

      // 2. 创建测试数据
      const roomType = await createTestRoomType();
      const room1 = await createTestRoom(roomType.type_code, { room_number: '301' });
      const room2 = await createTestRoom(roomType.type_code, { room_number: '302' });

      const order1 = await createTestOrder({
        room_number: room1.room_number,
        room_type: roomType.type_code,
        check_in_date: testDate,
        total_price: 800,
        deposit: 200
      }, { insert: true });

      const order2 = await createTestOrder({
        room_number: room2.room_number,
        room_type: roomType.type_code,
        check_in_date: testDate,
        total_price: 400,
        deposit: 100
      }, { insert: true });

      // 3. 创建收入和退押金账单
      await query(`
        INSERT INTO bills (order_id, room_number, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date, create_time) VALUES
        ($1, $4, '现金', 800, '订单账单', 200, '客房', 600, $3, NOW()),
        ($2, $5, '微信', 400, '订单账单', 100, '休息房', 300, $3, NOW()),
        ($1, $4, '现金', 150, '退押', 0, '客房', 0, $3, NOW()),
        ($2, $5, '微信', 80, '退押', 0, '休息房', 0, $3, NOW())
      `, [order1.order_id, order2.order_id, testDate, room1.room_number, room2.room_number]);

      // 4. 获取计算结果
      const res = await request(app)
        .get(`/api/handover/table?date=${testDate}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // 验证收入
      expect(data.hotelIncome['现金']).toBe(800);
      expect(data.restIncome['微信']).toBe(400);

      // 验证退押金
      expect(data.hotelDeposit['现金']).toBe(150);
      expect(data.restDeposit['微信']).toBe(80);

      // 验证总收入
      expect(data.totalIncome).toEqual({
        '现金': 1800,  // 800 + 1000(备用金)
        '微信': 900,   // 400 + 500(备用金)
        '微邮付': 0,
        '其他': 0
      });

      // 验证交接款（扣除退押金和留存款）
      expect(data.handoverAmount).toEqual({
        '现金': 1330,  // 1800 - 150(退押) - 320(留存)
        '微信': 820,   // 900 - 80(退押)
        '微邮付': 0,
        '其他': 0
      });
    });
  });

  /**
   * 测试案例4：无前日数据的新开始场景
   * 场景：第一天开始使用系统，没有前一天的交接款数据
   */
  describe('案例4：无前日数据的新开始场景', () => {
    it('应该正确处理没有前日交接款的情况', async () => {
      const testDate = '2024-01-01';

      // 不插入前一天的数据，模拟新开始的情况

      // 创建当天的订单
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code, { room_number: '101' });
      const order = await createTestOrder({
        room_number: room.room_number,
        room_type: roomType.type_code,
        check_in_date: testDate,
        total_price: 300,
        deposit: 100
      }, { insert: true });

      await query(`
        INSERT INTO bills (order_id, room_number, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date, create_time)
        VALUES ($1, $3, '现金', 300, '订单账单', 100, '客房', 200, $2, NOW())
      `, [order.order_id, testDate, room.room_number]);

      const res = await request(app)
        .get(`/api/handover/table?date=${testDate}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // 验证备用金为0（没有前日数据）
      expect(data.reserve).toEqual({
        '现金': 0,
        '微信': 0,
        '微邮付': 0,
        '其他': 0
      });

      // 验证收入
      expect(data.hotelIncome['现金']).toBe(300);

      // 验证总收入（只有当日收入，无备用金）
      expect(data.totalIncome['现金']).toBe(300);

      // 验证交接款（扣除留存款）
      expect(data.handoverAmount['现金']).toBe(-20);  // 300 - 320 = -20
    });
  });

  /**
   * 测试案例5：大额交易和边界情况
   * 场景：测试大额交易和各种边界值
   */
  describe('案例5：大额交易和边界情况', () => {
    it('应该正确处理大额交易', async () => {
      const testDate = '2024-01-05';
      const prevDate = '2024-01-04';

      // 设置大额前日交接款
      await query(`
        INSERT INTO handover (date, payment_type, handover, handover_person, takeover_person) VALUES
        ('${prevDate}', 1, 50000, '测试交班人', '测试接班人'),  -- 5万现金
        ('${prevDate}', 2, 30000, '测试交班人', '测试接班人'),  -- 3万微信
        ('${prevDate}', 3, 10000, '测试交班人', '测试接班人'),  -- 1万微邮付
        ('${prevDate}', 4, 5000, '测试交班人', '测试接班人')    -- 5千其他
      `);

      // 创建大额订单
      const roomType = await createTestRoomType({ base_price: '1888.00' });
      const room = await createTestRoom(roomType.type_code, { room_number: '501' });
      const order = await createTestOrder({
        room_number: room.room_number,
        room_type: roomType.type_code,
        check_in_date: testDate,
        total_price: 25000,  // 大额订单
        deposit: 5000
      }, { insert: true });

      await query(`
        INSERT INTO bills (order_id, room_number, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date, create_time)
        VALUES ($1, $3, '现金', 25000, '订单账单', 5000, '客房', 20000, $2, NOW())
      `, [order.order_id, testDate, room.room_number]);

      const res = await request(app)
        .get(`/api/handover/table?date=${testDate}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // 验证大额计算
      expect(data.hotelIncome['现金']).toBe(25000);
      expect(data.totalIncome['现金']).toBe(75000);  // 25000 + 50000
      expect(data.handoverAmount['现金']).toBe(74680);  // 75000 - 320
    });

    it('应该正确处理零值和负值情况', async () => {
      const testDate = '2024-01-06';
      const prevDate = '2024-01-05';

      // 设置很小的前日交接款
      await query(`
        INSERT INTO handover (date, payment_type, handover, handover_person, takeover_person) VALUES
        ('${prevDate}', 1, 100, '测试交班人', '测试接班人'),
        ('${prevDate}', 2, 0, '测试交班人', '测试接班人'),
        ('${prevDate}', 3, 0, '测试交班人', '测试接班人'),
        ('${prevDate}', 4, 0, '测试交班人', '测试接班人')
      `);

      // 创建小额订单，主要用于退押金
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code, { room_number: '502' });
      const order = await createTestOrder({
        room_number: room.room_number,
        room_type: roomType.type_code,
        check_in_date: testDate,
        total_price: 200,
        deposit: 50
      }, { insert: true });

      // 插入订单账单和大额退押金
      await query(`
        INSERT INTO bills (order_id, room_number, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date, create_time) VALUES
        ($1, $3, '现金', 200, '订单账单', 50, '客房', 150, $2, NOW()),
        ($1, $3, '现金', 400, '退押', 0, '客房', 0, $2, NOW())
      `, [order.order_id, testDate, room.room_number]);

      const res = await request(app)
        .get(`/api/handover/table?date=${testDate}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // 验证负值情况
      expect(data.hotelIncome['现金']).toBe(200);
      expect(data.hotelDeposit['现金']).toBe(400);
      expect(data.totalIncome['现金']).toBe(300);  // 200 + 100
      expect(data.handoverAmount['现金']).toBe(-420);  // 300 - 400 - 320
    });
  });

  /**
   * 测试案例6：实际业务场景模拟
   * 场景：模拟一个典型酒店一天的真实交易
   */
  describe('案例6：实际业务场景模拟', () => {
    it('应该正确处理典型酒店一天的交易', async () => {
      const testDate = '2024-02-14';  // 情人节，生意较好
      const prevDate = '2024-02-13';

      // 前一天的交接款
      await query(`
        INSERT INTO handover (date, payment_type, handover, handover_person, takeover_person) VALUES
        ('${prevDate}', 1, 2500, '测试交班人', '测试接班人'),  -- 现金
        ('${prevDate}', 2, 4800, '测试交班人', '测试接班人'),  -- 微信
        ('${prevDate}', 3, 1200, '测试交班人', '测试接班人'),  -- 微邮付
        ('${prevDate}', 4, 300, '测试交班人', '测试接班人')    -- 其他
      `);

      // 创建多个房型和房间
      const standardType = await createTestRoomType({
        type_code: 'STD',
        type_name: '标准间',
        base_price: '288.00'
      });
      const deluxeType = await createTestRoomType({
        type_code: 'DLX',
        type_name: '豪华间',
        base_price: '388.00'
      });

      // 创建房间
      const rooms = [];
      for (let i = 1; i <= 8; i++) {
        const roomType = i <= 5 ? standardType.type_code : deluxeType.type_code;
        const room = await createTestRoom(roomType, { room_number: `20${i}` });
        rooms.push(room);
      }

      // 创建一天的订单（客房 + 休息房）
      const orders = [];
      const orderData = [
        { room: 0, price: 350, deposit: 100, stay_type: '客房', pay_way: '现金' },
        { room: 1, price: 380, deposit: 100, stay_type: '客房', pay_way: '微信' },
        { room: 2, price: 320, deposit: 100, stay_type: '客房', pay_way: '微邮付' },
        { room: 3, price: 450, deposit: 150, stay_type: '客房', pay_way: '微信' },
        { room: 4, price: 180, deposit: 50, stay_type: '休息房', pay_way: '现金' },
        { room: 5, price: 200, deposit: 50, stay_type: '休息房', pay_way: '微信' },
        { room: 6, price: 520, deposit: 200, stay_type: '客房', pay_way: '其他' },
        { room: 7, price: 160, deposit: 40, stay_type: '休息房', pay_way: '现金' }
      ];

      for (let i = 0; i < orderData.length; i++) {
        const data = orderData[i];
        const roomType = i <= 4 ? standardType.type_code : deluxeType.type_code;
        const order = await createTestOrder({
          room_number: rooms[data.room].room_number,
          room_type: roomType,
          check_in_date: testDate,
          total_price: data.price,
          deposit: data.deposit
        }, { insert: true });
        orders.push({ ...order, ...data });
      }

      // 插入所有账单
      for (const order of orders) {
        await query(`
          INSERT INTO bills (order_id, room_number, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date, create_time)
          VALUES ($1, $2, $3, $4, '订单账单', $5, $6, $7, $8, NOW())
        `, [
          order.order_id,
          order.room_number,
          order.pay_way,
          order.price,
          order.deposit,
          order.stay_type,
          order.price - order.deposit,
          testDate
        ]);
      }

      // 添加一些退押金
      await query(`
        INSERT INTO bills (order_id, room_number, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date, create_time) VALUES
        ($1, $4, '现金', 80, '退押', 0, '客房', 0, $2, NOW()),
        ($3, $5, '微信', 30, '退押', 0, '休息房', 0, $2, NOW())
      `, [orders[0].order_id, testDate, orders[5].order_id, orders[0].room_number, orders[5].room_number]);

      // 获取计算结果
      const res = await request(app)
        .get(`/api/handover/table?date=${testDate}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // 验证备用金
      expect(data.reserve).toEqual({
        '现金': 2500,
        '微信': 4800,
        '微邮付': 1200,
        '其他': 300
      });

      // 验证收入分类
      // 现金：350(客房) = 350
      expect(data.hotelIncome['现金']).toBe(350);
      // 现金休息房：180 + 160 = 340
      expect(data.restIncome['现金']).toBe(340);

      // 微信客房：380 + 450 = 830
      expect(data.hotelIncome['微信']).toBe(830);
      // 微信休息房：200
      expect(data.restIncome['微信']).toBe(200);

      // 微邮付客房：320
      expect(data.hotelIncome['微邮付']).toBe(320);

      // 其他客房：520
      expect(data.hotelIncome['其他']).toBe(520);

      // 验证退押金
      expect(data.hotelDeposit['现金']).toBe(80);
      expect(data.restDeposit['微信']).toBe(30);

      // 验证最终交接款
      // 现金：(350 + 340 + 2500) - 80 - 320 = 2790
      expect(data.handoverAmount['现金']).toBe(2790);
      // 微信：(830 + 200 + 4800) - 30 = 5800
      expect(data.handoverAmount['微信']).toBe(5800);
      // 微邮付：(320 + 1200) = 1520
      expect(data.handoverAmount['微邮付']).toBe(1520);
      // 其他：(520 + 300) = 820
      expect(data.handoverAmount['其他']).toBe(820);
    });
  });
});
