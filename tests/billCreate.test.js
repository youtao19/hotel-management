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

  // 创建测试订单的辅助函数
  async function createTestOrder(orderId, roomNumber = '101', offsetDays = 0) {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + offsetDays);

    // 确保房型和房间存在
    const typeCode = 'TEST_STANDARD';
    await createTestRoomType(typeCode);
    await createTestRoom(roomNumber, typeCode);

    // 等待一小段时间确保房间创建完成
    await new Promise(resolve => setTimeout(resolve, 100));

    const orderData = {
      order_id: orderId,
      order_source: 'front_desk',
      guest_name: '张三',
      id_number: '123456789012345678',
      phone: '13800138000',
      room_type: typeCode, // 使用实际存在的房型
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

    // 确保房间存在后再创建订单
    try {
      const response = await request(app)
        .post('/api/orders/new')
        .send(orderData)
        .set('Accept', 'application/json');

      if (response.status !== 201) {
        throw new Error(`Failed to create test order: ${response.status} ${JSON.stringify(response.body)}`);
      }

      return response.body;
    } catch (error) {
      console.error('创建测试订单失败:', error.message);
      throw error;
    }
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
