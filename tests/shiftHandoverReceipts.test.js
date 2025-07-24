const request = require('supertest');
const app = require('../app');
const { initializeHotelDB, closePool, query } = require('../backend/database/postgreDB/pg');

// 测试收款明细接口
describe('GET /api/shift-handover/receipts\n测试收款明细接口', () => {
  beforeAll(async () => { // 初始化数据库
    await initializeHotelDB();
  });

  beforeEach(async () => { // 每次测试前清空数据
    await query('DELETE FROM bills');
    await query('DELETE FROM orders');
  });

  afterAll(async () => {
    await query('DELETE FROM bills');
    await query('DELETE FROM orders');
    await closePool();
  });

  // 辅助函数：插入一条房型、房间、订单和账单
  async function insertTestData({
    order_id = 'TEST_ORDER_1',
    room_number = '403',
    type_code = 'xing_yun_ge',
    check_in_date = '2025-07-01',
    check_out_date = '2025-07-02',
    guest_name = '张三',
    room_fee = '300.00',
    deposit = '100.00',
    pay_way = '现金',
    total_income = '400.00',
  } = {}) {
    await query(`INSERT INTO room_types(type_code, type_name, base_price, description) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [type_code, '标准房', 200, '测试房型']);
    await query(`INSERT INTO rooms(room_id, room_number, type_code, status, price) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`, [201, room_number, type_code, 'clean', 200]);
    await query(`INSERT INTO orders(order_id, order_source, guest_name, id_number, phone, room_type, room_number, check_in_date, check_out_date, status, payment_method, room_price, deposit, create_time, remarks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),$14)`, [order_id, 'front_desk', guest_name, '123456789012345678', '13800138000', type_code, room_number, check_in_date, check_out_date, 'checked-in', pay_way, room_fee, deposit, '测试订单']);
    await query(`INSERT INTO bills(order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, create_time, remarks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),$9)`, [order_id, room_number, guest_name, deposit, false, room_fee, total_income, pay_way, '测试账单']);
  }

  it('正常返回收款明细', async () => {
    await insertTestData();
    const res = await request(app)
      .get('/api/shift-handover/receipts')
      .query({ startDate: '2025-07-01', endDate: '2025-07-02' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true); // 检查返回的数据是否为数组
    expect(res.body.length).toBeGreaterThan(0); // 检查返回的数据是否不为空
    const item = res.body[0];
    expect(item).toHaveProperty('room_fee', '300.00'); // 检查房费是否为300.00
    expect(item).toHaveProperty('deposit', '100.00'); // 检查押金是否为100.00
    expect(item).toHaveProperty('payment_method', '现金'); // 检查支付方式是否为现金
    expect(item).toHaveProperty('total_amount', '400.00'); // 检查总金额是否为400.00
    expect(item).toHaveProperty('room_number', '403'); // 检查房间号是否为403
  });

  it('无数据时返回空数组', async () => {
    const res = await request(app)
      .get('/api/shift-handover/receipts')
      .query({ startDate: '2099-01-01', endDate: '2099-01-02' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('无效type参数应返回400', async () => {
    const res = await request(app)
      .get('/api/shift-handover/receipts')
      .query({ type: 'invalid', startDate: '2025-07-01', endDate: '2025-07-02' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', '无效的交接班类型，必须是 hotel 或 rest');
  });

  it('无效日期格式应返回400', async () => {
    const res = await request(app)
      .get('/api/shift-handover/receipts')
      .query({ startDate: '20250701', endDate: '2025-07-02' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', '无效的开始日期格式，应为 YYYY-MM-DD');
  });
});
