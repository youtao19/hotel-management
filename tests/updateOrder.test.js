const request = require('supertest');
const app = require('../app');
const { initializeHotelDB, closePool, query } = require('../backend/database/postgreDB/pg');

// 定义一个有效的订单对象作为基准数据
const validOrder = {
  order_id: 'test_update_order',
  order_source: 'front_desk',
  guest_name: '张三',
  id_number: '511123299001010101',
  phone: '13800138000',
  room_type: 'asu_xiao_zhu',
  room_number: '110',
  check_in_date: '2025-06-09',
  check_out_date: '2025-06-10',
  status: 'pending',
  payment_method: 'cash',
  room_price: '200.00',
  deposit: '100.00',
  remarks: '测试订单'
};



describe('GET /api/orders/:orderNumber/status',() => {
  beforeAll(async () => {
    await initializeHotelDB();

    // 先创建一个预定订单
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


  afterAll(async () => {
    await query('DELETE FROM orders');
    await closePool();
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
