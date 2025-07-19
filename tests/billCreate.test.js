const request = require('supertest');
const app = require('../app');
const { initializeHotelDB, closePool, query } = require('../backend/database/postgreDB/pg');

describe('POST /api/bills/create', () => {
  beforeAll(async () => {
    await initializeHotelDB();
  });

  beforeEach(async () => {
    await query('DELETE FROM bills');
    await query('DELETE FROM orders');
  });

  afterAll(async () => {
    await query('DELETE FROM bills');
    await query('DELETE FROM orders');
    await closePool();
  });

  // 创建测试订单的辅助函数
  async function createTestOrder(orderId, roomNumber = '101', offsetDays = 0) {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + offsetDays);

    const orderData = {
      order_id: orderId,
      order_source: 'front_desk',
      guest_name: '张三',
      id_number: '123456789012345678',
      phone: '13800138000',
      room_type: 'standard',
      room_number: roomNumber,
      check_in_date: baseDate.toISOString(),
      check_out_date: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      payment_method: 'cash',
      room_price: '200.00',
      deposit: '100.00',
      create_time: baseDate.toISOString(),
      remarks: '测试订单'
    };

    const response = await request(app)
      .post('/api/orders/new')
      .send(orderData)
      .set('Accept', 'application/json');

    if (response.status !== 201) {
      throw new Error(`Failed to create test order: ${response.status} ${JSON.stringify(response.body)}`);
    }

    return response.body;
  }

  it('成功创建一个新账单', async () => {
    const orderId = 'TEST' + Date.now();
    // 创建测试订单 - 使用房间104和未来日期避免冲突
    await createTestOrder(orderId, '104', 1);
    // 账单数据
    const billData = {
      order_id: orderId,
      room_number: '104',
      guest_name: '张三',
      deposit: '200.00',
      refund_deposit: 'yes',
      room_fee: '500.00',
      total_income: '700.00',
      pay_way: { value: 'cash' },
      remarks: '测试账单'
    };

    // 创建账单
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
    // 确保订单创建完成
    await createTestOrder(orderId, '105', 2);

    // 等待一小段时间确保订单已保存
    await new Promise(resolve => setTimeout(resolve, 100));

    const billData = {
      order_id: orderId,
      room_number: '105',
      guest_name: '张三',
      deposit: '200.00',
      refund_deposit: 'yes',
      room_fee: '500.00',
      total_income: '700.00',
      pay_way: { value: 'cash' },
      remarks: '测试账单'
    };

    // 第一次创建
    const res = await request(app)
      .post('/api/bills/create')
      .send(billData)
      .set('Accept', 'application/json');
    expect(res.status).toBe(201);

    // 第二次创建
    const res2 = await request(app)
      .post('/api/bills/create')
      .send(billData)
      .set('Accept', 'application/json');

    expect(res2.status).toBe(400);
    expect(res2.body).toHaveProperty('message', '账单已存在，请勿重复创建');
  });

  it('正确处理不同的退押金状态', async () => {
    const orderId = 'TEST' + Date.now();
    // 确保订单创建完成
    await createTestOrder(orderId, '106', 3);

    // 等待一小段时间确保订单已保存
    await new Promise(resolve => setTimeout(resolve, 100));
    const billData = {
      order_id: orderId,
      room_number: '106',
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

  it('验证必填字段', async () => {
    const res = await request(app)
      .post('/api/bills/create')
      .send({})
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
  });

});
