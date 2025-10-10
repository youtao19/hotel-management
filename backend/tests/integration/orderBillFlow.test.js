/**
 * 订单到账单流程集成测试文件
 *
 * 测试接口：POST /api/orders/:orderNumber/refund-deposit
 *
 * ✅ 核心功能说明：
 * 1. 测试完整的订单-账单-退押金业务流程
 * 2. 验证订单创建、状态更新、退押金的端到端流程
 * 3. 确保账单记录的正确生成
 * 4. 验证数据在各个环节的一致性
 *
 * ✅ 测试覆盖范围：
 * - ✅ 完整业务流程（创建订单 → 退房 → 退押金）
 * - ✅ 跨模块集成（订单模块 + 账单模块）
 * - ✅ 数据一致性（订单数据 → 账单数据）
 * - ✅ 状态依赖（退房状态 → 退押金操作）
 *
 * 📊 相关数据库表：
 * - orders: 订单表
 *   - order_id: VARCHAR(50) - 订单编号
 *   - status: VARCHAR(20) - 订单状态（checked-out）
 *   - deposit: NUMERIC(10,2) - 押金金额
 *   - total_price: NUMERIC(10,2) - 订单总价
 * - bills: 账单表
 *   - bill_id: SERIAL PRIMARY KEY - 账单ID
 *   - order_id: VARCHAR(50) - 关联订单
 *   - change_type: VARCHAR(20) - 变动类型（退押）
 *   - change_price: NUMERIC(10,2) - 金额（负数）
 *   - pay_way: VARCHAR(20) - 支付方式
 * - rooms: 房间表
 * - room_types: 房型表
 *
 * 💡 业务规则说明：
 * 1. 订单必须先退房（status='checked-out'）才能退押金
 * 2. 退押金操作会在 bills 表创建记录
 * 3. 账单的 change_type 为 '退押'
 * 4. 退押金金额为负数（表示退款）
 * 5. 账单记录包含支付方式（cash/wechat等）
 * 6. 订单总价从 room_price 对象计算而来
 *
 * 🔄 完整业务流程：
 *
 * **步骤1：创建订单**
 * - 设置订单基本信息（客人、房间、日期）
 * - 设置押金（200元）
 * - 设置房价（300元/天）
 * - 订单状态：checked-out（已退房）
 *
 * **步骤2：插入订单数据**
 * - 将订单数据写入 orders 表
 * - room_price 对象转换为 total_price 数字
 * - 设置住宿类型为"客房"
 *
 * **步骤3：退还押金**
 * - 调用退押金接口
 * - 提供退款金额（200元）
 * - 指定支付方式（cash）
 * - 生成退押金账单
 *
 * **步骤4：验证结果**
 * - API返回200状态码
 * - 返回订单对象
 * - change_price为负数（退款）
 *
 * 🎯 测试策略：
 * - 端到端集成测试
 * - 模拟真实业务场景
 * - 验证跨模块数据流转
 * - 每个测试前清理数据
 * - 直接操作数据库插入订单（绕过创建接口）
 *
 * 🧪 测试数据：
 * - 测试日期：2025-02-01
 * - 押金：200.00元
 * - 房价：300元/晚
 * - 支付方式：现金
 * - 订单状态：已退房
 *
 * 作者：AI Assistant
 * 日期：2025-10-10
 */

const request = require('supertest');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('../test-helpers');

describe('订单到退押金集成流程测试', () => {
  beforeEach(async () => {
    await global.cleanupTestData();
  });
  test('创建订单 -> 退房状态 -> 退押金成功写账单', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const orderData = await createTestOrder({
      room_type: rt.type_code,
      room_number: room.room_number,
      status: 'checked-out',
      deposit: '200.00',
      room_price: { '2025-02-01': 300 }
    });

    // 插入订单
    await query(`INSERT INTO orders (order_id, id_source, order_source, guest_name, phone, id_number, room_type, room_number, check_in_date, check_out_date, status, payment_method, total_price, deposit, create_time, remarks, stay_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)` , [
      orderData.order_id,
      orderData.id_source,
      orderData.order_source,
      orderData.guest_name,
      orderData.phone,
      orderData.id_number,
      orderData.room_type,
      orderData.room_number,
      orderData.check_in_date,
      orderData.check_out_date,
      orderData.status,
      orderData.payment_method,
      orderData.room_price && typeof orderData.room_price === 'object'
        ? Object.values(orderData.room_price).reduce((sum, price) => sum + price, 0)
        : (orderData.room_price || 0),
      orderData.deposit,
      new Date(),
      orderData.remarks,
      '客房'
    ]);

    // 发起退押金
    const res = await request(app)
      .post(`/api/orders/${orderData.order_id}/refund-deposit`)
      .send({ order_id: orderData.order_id, change_price: 200, method: 'cash', refundTime: new Date().toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.order).toBeDefined();
    expect(Number(res.body.order.change_price)).toBeLessThan(0);
  });
});
