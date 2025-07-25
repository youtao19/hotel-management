const request = require('supertest');
const app = require('../app');
const { query } = require('../backend/database/postgreDB/pg');

// 定义一个有效的订单对象作为基准数据
const validOrder = {
  order_id: 'test_update_order',
  order_source: 'front_desk',
  guest_name: '张三',
  id_number: '511123299001010101',
  phone: '13800138000',
  room_type: 'TEST_STANDARD', // 使用测试房型
  room_number: '110',
  check_in_date: '2025-06-09',
  check_out_date: '2025-06-10',
  status: 'pending',
  payment_method: 'cash',
  room_price: '200.00',
  deposit: '100.00',
  remarks: '测试订单'
};

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



describe('GET /api/orders/:orderNumber/status',() => {
  beforeEach(async () => {
    // 使用全局清理函数
    await global.cleanupTestData();

    // 确保房型和房间存在
    await createTestRoomType(validOrder.room_type);
    await createTestRoom(validOrder.room_number, validOrder.room_type);

    // 等待一小段时间确保创建完成
    await new Promise(resolve => setTimeout(resolve, 100));

    // 先删除可能存在的订单，然后创建新的
    await query('DELETE FROM orders WHERE order_id = $1', [validOrder.order_id]);

    // 创建一个预定订单
    await query('INSERT INTO orders (order_id, order_source, guest_name, id_number, phone, room_type, room_number, check_in_date, check_out_date, status, payment_method, room_price, deposit, create_time, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)', [
      validOrder.order_id,
      validOrder.order_source,
      validOrder.guest_name,
      validOrder.id_number,
      validOrder.phone,
      validOrder.room_type,
      validOrder.room_number,
      validOrder.check_in_date,
      validOrder.check_out_date,
      validOrder.status,
      validOrder.payment_method,
      validOrder.room_price,
      validOrder.deposit,
      new Date(), // 添加 create_time 值
      validOrder.remarks
    ]);

  });




  it('修改订单状态为已入住', async () => {
    const res = await request(app).post(`/api/orders/${validOrder.order_id}/status`).send({
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
    const res = await request(app).post(`/api/orders/${validOrder.order_id}/status`).send({
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
    const res = await request(app).post(`/api/orders/${validOrder.order_id}/status`).send({
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
