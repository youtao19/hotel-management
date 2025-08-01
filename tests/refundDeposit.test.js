const request = require('supertest');
const app = require('../app');
const { query } = require('../backend/database/postgreDB/pg');

describe('POST /api/orders/:orderNumber/refund-deposit', () => {
  const testOrder = {
    order_id: 'TEST_REFUND_001',
    order_source: 'front_desk',
    guest_name: '测试退款',
    id_number: '111111111111111111',
    phone: '13900000000',
    room_type: 'TEST_REFUND_TYPE', // 使用测试房型
    room_number: '403', // 使用一个测试中不常用的房间号
    check_in_date: '2025-08-01',
    check_out_date: '2025-08-02',
    status: 'checked-out', // 退款前订单通常是已退房状态
    payment_method: '微信',
    room_price: '300.00',
    deposit: '150.00',
    remarks: '测试退款订单'
  };

  beforeEach(async () => {
    // 使用全局清理函数
    await global.cleanupTestData();

    // 插入依赖数据
    await query(`
      INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
      VALUES ($1, '测试退款房型', 300, '测试用房型', false)
      ON CONFLICT (type_code) DO NOTHING
    `, [testOrder.room_type]);

    await query(`
      INSERT INTO rooms (room_id, room_number, type_code, status, price, is_closed)
      VALUES (10403, $1, $2, 'clean', 300, false)
      ON CONFLICT (room_number) DO UPDATE SET
      type_code = EXCLUDED.type_code, status = EXCLUDED.status, price = EXCLUDED.price
    `, [testOrder.room_number, testOrder.room_type]);

    // 插入测试订单
    await query(
      `INSERT INTO orders (order_id, order_source, guest_name, id_number, phone, room_type, room_number, check_in_date, check_out_date, status, payment_method, room_price, deposit, create_time, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), $14)`,
      [
        testOrder.order_id, testOrder.order_source, testOrder.guest_name, testOrder.id_number,
        testOrder.phone, testOrder.room_type, testOrder.room_number, testOrder.check_in_date,
        testOrder.check_out_date, testOrder.status, testOrder.payment_method, testOrder.room_price,
        testOrder.deposit, testOrder.remarks
      ]
    );
  });

  it('应成功处理退押金请求', async () => {
    const refundData = {
      refundAmount: '150.00',
      actualRefundAmount: '150.00',
      method: 'wechat',
      operator: 'test_admin'
    };

    const res = await request(app)
      .post(`/api/orders/${testOrder.order_id}/refund-deposit`)
      .send(refundData);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('退押金处理成功');
    expect(res.body.order).toBeDefined();
    expect(res.body.refundData).toMatchObject({
      actualRefundAmount: refundData.actualRefundAmount,
      method: refundData.method,
    });
  });

  it('当缺少必要字段时应返回400错误', async () => {
    const refundData = {
      refundAmount: '150.00',
      // actualRefundAmount 缺失
      method: 'wechat',
      operator: 'test_admin'
    };

    const res = await request(app)
      .post(`/api/orders/${testOrder.order_id}/refund-deposit`)
      .send(refundData);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('请求数据验证失败');
    expect(res.body.errors).toBeInstanceOf(Array);
    expect(res.body.errors.some(e => e.path === 'actualRefundAmount')).toBe(true);
  });

  it('当字段类型不正确时应返回400错误', async () => {
    const refundData = {
      refundAmount: 'not-a-number',
      actualRefundAmount: '150.00',
      method: 'wechat',
      operator: 'test_admin'
    };

    const res = await request(app)
      .post(`/api/orders/${testOrder.order_id}/refund-deposit`)
      .send(refundData);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('请求数据验证失败');
    expect(res.body.errors).toBeInstanceOf(Array);
    expect(res.body.errors.some(e => e.path === 'refundAmount' && e.msg === '退押金金额必须是数字')).toBe(true);
  });

  it('当订单号不存在时应返回500错误', async () => {
    const refundData = {
      refundAmount: '150.00',
      actualRefundAmount: '150.00',
      method: 'wechat',
      operator: 'test_admin'
    };

    const res = await request(app)
      .post('/api/orders/NON_EXISTENT_ORDER/refund-deposit')
      .send(refundData);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('退押金处理失败');
  });
});
