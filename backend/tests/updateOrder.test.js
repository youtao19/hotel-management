const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('./test-helpers');

// 更改订单状态
describe('GET /api/orders/:orderNumber/status',() => {
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
      room_price: { '2025-06-09': 200.00 },
  }, { insert: true });
  });

  it('修改订单状态为已入住', async () => {
    const res = await request(app).post(`/api/orders/${testOrder.order_id}/status`).send({
      newStatus: 'checked-in',
      checkInTime: '2025-06-09',
      checkOutTime: '2025-06-10'
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: '订单状态更新成功'
    });
  })

  it('修改订单状态为已退房', async () => {
    const res = await request(app).post(`/api/orders/${testOrder.order_id}/status`).send({
      newStatus: 'checked-out',
      checkInTime: '2025-06-09',
      checkOutTime: '2025-06-10'
    });

    expect(res.status).toBe(200); // 200 表示请求成功
    expect(res.body).toMatchObject({ // 检查响应体是否包含成功信息
      message: '订单状态更新成功'
    });
  })

  it('修改订单状态为已取消', async () => {
    const res = await request(app).post(`/api/orders/${testOrder.order_id}/status`).send({
      newStatus: 'cancelled',
      checkInTime: '2025-06-09',
      checkOutTime: '2025-06-10'
    });

    expect(res.status).toBe(200); // 200 表示请求成功
    expect(res.body).toMatchObject({ // 检查响应体是否包含成功信息
      message: '订单状态更新成功'
    });
  })
})
