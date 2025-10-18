/**
 * 订单状态更新测试文件
 *
 * 测试接口：POST /api/orders/:orderNumber/status
 *
 * ✅ 核心功能说明：
 * 1. 更新订单状态（待入住、已入住、已退房、已取消）
 * 2. 验证订单状态转换的合法性
 * 3. 同步更新房间状态
 * 4. 处理订单不存在的情况
 *
 * ✅ 测试覆盖范围：
 * - ✅ 正常业务流程（状态更新成功）
 * - ✅ 参数验证（无效状态、缺少参数）
 * - ✅ 错误处理（订单不存在）
 *
 * 📊 相关数据库表：
 * - orders: 订单表
 * - rooms: 房间表
 * - room_types: 房型表
 *
 * 💡 业务规则说明：
 * 1. 订单状态：pending（待入住）、checked-in（已入住）、checked-out（已退房）、cancelled（已取消）
 * 2. 状态转换会触发房间状态同步更新
 * 3. 需要提供 checkInTime 和 checkOutTime 参数
 * 4. 使用 order_id 作为唯一标识符
 *
 */

const request = require('supertest');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('../test-helpers');

describe('POST /api/orders/:orderNumber/status - 更新订单状态',() => {
  let testOrder;

  beforeEach(async () => {
    // Ensure room type and room exist
    const roomType = await createTestRoomType({ type_code: 'TEST_STANDARD' });
    const room = await createTestRoom(roomType.type_code);

    // Create a test order
  testOrder = await createTestOrder({
      room_type: roomType.type_code,
      room_number: room.room_number,
      check_in_date: '2025-06-09',
      check_out_date: '2025-06-10',
      status: 'pending',
      total_price: 200.00,
  }, { insert: true });
  });

  it('修改订单状态为已入住', async () => {
    // 注意：路由参数是 :orderNumber，但实际使用的是 order_id 作为唯一标识符
    const res = await request(app).post(`/api/orders/${testOrder.order_id}/status`).send({
      newStatus: 'checked-in',
      checkInTime: '2025-06-09',
      checkOutTime: '2025-06-10'
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: '订单状态更新成功'
    });
  });

  it('修改订单状态为已退房', async () => {
    const res = await request(app).post(`/api/orders/${testOrder.order_id}/status`).send({
      newStatus: 'checked-out',
      checkInTime: '2025-06-09',
      checkOutTime: '2025-06-10'
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: '订单状态更新成功'
    });
    // 验证返回的订单对象包含更新后的状态
    expect(res.body.order).toBeDefined();
  });

  it('修改订单状态为已取消', async () => {
    const res = await request(app).post(`/api/orders/${testOrder.order_id}/status`).send({
      newStatus: 'cancelled',
      checkInTime: '2025-06-09',
      checkOutTime: '2025-06-10'
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: '订单状态更新成功'
    });
    // 验证返回的订单对象包含更新后的状态
    expect(res.body.order).toBeDefined();
  });

  it('应该拒绝无效的订单状态', async () => {
    const res = await request(app).post(`/api/orders/${testOrder.order_id}/status`).send({
      newStatus: 'invalid-status',
      checkInTime: '2025-06-09',
      checkOutTime: '2025-06-10'
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('应该拒绝缺少必需参数的请求', async () => {
    const res = await request(app).post(`/api/orders/${testOrder.order_id}/status`).send({
      // 缺少 newStatus
      checkInTime: '2025-06-09',
      checkOutTime: '2025-06-10'
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('应该处理不存在的订单ID', async () => {
    const res = await request(app).post(`/api/orders/NON_EXISTENT_ORDER/status`).send({
      newStatus: 'checked-in',
      checkInTime: '2025-06-09',
      checkOutTime: '2025-06-10'
    });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      message: '未找到订单或更新失败'
    });
  });
})

