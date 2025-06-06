const request = require('supertest');
const app = require('../app');
const { initializeHotelDB, closePool, query } = require('../backend/database/postgreDB/pg');

describe('POST /api/bills/create', () => {
  beforeAll(async () => {
    await initializeHotelDB();
  });

  beforeEach(async () => {
    // 清理测试数据
    await query('DELETE FROM bills ');
  });

  afterAll(async () => {
    await closePool();
  });

  // 创建测试订单的辅助函数
  async function createTestOrder(orderId) {
    const orderData = {
      order_id: orderId,
      order_source: 'front_desk',
      guest_name: '张三',
      id_number: '123456789012345678',
      phone: '13800138000',
      room_type: 'standard',
      room_number: '101',
      check_in_date: '2024-03-15',
      check_out_date: '2024-03-16',
      status: 'pending',
      payment_method: 'cash',
      room_price: '200.00',
      deposit: '100.00',
      create_time: new Date().toISOString(),
      remarks: '测试订单'
    };

    await request(app)
      .post('/api/orders/new')
      .send(orderData)
      .set('Accept', 'application/json');
  }

  it('应成功创建一个新账单', async () => {
    const orderId = 'TEST' + Date.now();
    await createTestOrder(orderId);

    const billData = {
      order_id: orderId,
      room_number: '101',
      guest_name: '张三',
      deposit: '200.00',
      refund_deposit: 'yes',
      room_fee: '500.00',
      total_income: '700.00',
      pay_way: { value: 'cash' },
      remarks: '测试账单'
    };

    const res = await request(app)
      .post('/api/bills/create')
      .send(billData)
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', '账单创建成功');
    expect(res.body).toHaveProperty('bill');
    expect(res.body.bill).toMatchObject({
      order_id: billData.order_id,
      guest_name: billData.guest_name,
      room_number: billData.room_number,
      deposit: billData.deposit,
      refund_deposit: true,
      room_fee: billData.room_fee,
      total_income: billData.total_income,
      pay_way: 'cash'
    });
  });

  it('不应重复创建已存在的账单', async () => {
    const orderId = 'TEST' + Date.now();
    await createTestOrder(orderId);

    const billData = {
      order_id: orderId,
      room_number: '101',
      guest_name: '张三',
      deposit: '200.00',
      refund_deposit: 'yes',
      room_fee: '500.00',
      total_income: '700.00',
      pay_way: { value: 'cash' },
      remarks: '测试账单'
    };

    // 第一次创建
    await request(app)
      .post('/api/bills/create')
      .send(billData)
      .set('Accept', 'application/json');

    // 尝试重复创建
    const res = await request(app)
      .post('/api/bills/create')
      .send(billData)
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message', '账单已存在，请勿重复创建');
  });

  it('应正确处理不同的退押金状态', async () => {
    const orderId = 'TEST' + Date.now();
    await createTestOrder(orderId);

    const billData = {
      order_id: orderId,
      room_number: '101',
      guest_name: '张三',
      deposit: '200.00',
      refund_deposit: 'no',
      room_fee: '500.00',
      total_income: '700.00',
      pay_way: { value: 'cash' },
      remarks: '测试账单-不退押金'
    };

    const res = await request(app)
      .post('/api/bills/create')
      .send(billData)
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body.bill.refund_deposit).toBe(false);
  });

  it('应验证必填字段', async () => {
    const res = await request(app)
      .post('/api/bills/create')
      .send({})
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
  });
});
