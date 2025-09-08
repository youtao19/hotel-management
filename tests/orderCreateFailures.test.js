const request = require('supertest');
const app = require('../app');
const { createTestRoomType, createTestRoom, createTestOrder } = require('./test-helpers');

// 专注覆盖尚未测试的失败分支
describe('POST /api/orders/new 失败分支补充', () => {
  beforeEach(global.cleanupTestData);

  test('无效手机号格式', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const order = await createTestOrder({ room_type: rt.type_code, room_number: room.room_number, phone: '12345' });
    const res = await request(app).post('/api/orders/new').send(order);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('电话号码');
  });

  test('入住日期晚于退房日期', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const order = await createTestOrder({
      room_type: rt.type_code,
      room_number: room.room_number,
      check_in_date: '2025-10-05',
      check_out_date: '2025-10-01'
    });
    const res = await request(app).post('/api/orders/new').send(order);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('入住日期不能晚于退房日期');
  });

  test('押金为负数', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const order = await createTestOrder({ room_type: rt.type_code, room_number: room.room_number, deposit: '-10' });
    const res = await request(app).post('/api/orders/new').send(order);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('押金不能为负');
  });

  test('价格为数字且 <=0', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const base = await createTestOrder({ room_type: rt.type_code, room_number: room.room_number });
    const order = { ...base, room_price: 0 }; // 数字 0
    const res = await request(app).post('/api/orders/new').send(order);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('房间价格必须大于0');
  });

  test('房间已被预订（日期区间重叠）', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const o1 = await createTestOrder({ room_type: rt.type_code, room_number: room.room_number, check_in_date: '2025-09-10', check_out_date: '2025-09-12' });
    const o2 = await createTestOrder({ room_type: rt.type_code, room_number: room.room_number, check_in_date: '2025-09-11', check_out_date: '2025-09-13' });
    await request(app).post('/api/orders/new').send(o1); // 第一单成功
    const res = await request(app).post('/api/orders/new').send(o2); // 第二单冲突
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/已被预订|占用/);
  });

  test('休息房同日冲突', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const day = '2025-09-20';
    const o1 = await createTestOrder({ room_type: rt.type_code, room_number: room.room_number, check_in_date: day, check_out_date: day, room_price: { [day]: 150 } });
    const o2 = await createTestOrder({ room_type: rt.type_code, room_number: room.room_number, check_in_date: day, check_out_date: day, room_price: { [day]: 180 } });
    await request(app).post('/api/orders/new').send(o1);
    const res = await request(app).post('/api/orders/new').send(o2);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/休息房预订|被其他订单占用/);
  });

  test('房间已关闭', async () => {
    const rt = await createTestRoomType();
    // 创建关闭房间
    const room = await createTestRoom(rt.type_code, { is_closed: true });
    const order = await createTestOrder({ room_type: rt.type_code, room_number: room.room_number });
    const res = await request(app).post('/api/orders/new').send(order);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('已关闭');
  });

  test('无效住宿类型 stay_type', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const order = await createTestOrder({ room_type: rt.type_code, room_number: room.room_number, stay_type: '长租' });
    const res = await request(app).post('/api/orders/new').send(order);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('无效的住宿类型');
  });

  test('单晚住宿价格包含退房日（多一天）', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const order = await createTestOrder({
      room_type: rt.type_code,
      room_number: room.room_number,
      check_in_date: '2025-11-01',
      check_out_date: '2025-11-02',
      room_price: { '2025-11-01': 200, '2025-11-02': 220 }
    });
    const res = await request(app).post('/api/orders/new').send(order);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/单日住宿订单价格数据应只包含入住日期/);
  });

  test('多日住宿价格包含退房日（多一天尾巴）', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    const order = await createTestOrder({
      room_type: rt.type_code,
      room_number: room.room_number,
      check_in_date: '2025-11-05',
      check_out_date: '2025-11-08', // 3晚 -> 需要 11-05 / 06 / 07
      room_price: { '2025-11-05': 200, '2025-11-06': 210, '2025-11-07': 220, '2025-11-08': 230 }
    });
    const res = await request(app).post('/api/orders/new').send(order);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/结束日期|不匹配/);
  });

  test('无效日期格式 (check_in_date)', async () => {
    const rt = await createTestRoomType();
    const room = await createTestRoom(rt.type_code);
    // 使用明显无效日期触发 INVALID_DATE_FORMAT 分支
    const order = await createTestOrder({ room_type: rt.type_code, room_number: room.room_number, check_in_date: 'invalid-date', check_out_date: '2025-12-02' });
    const res = await request(app).post('/api/orders/new').send(order);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('无效的日期格式');
  });
});
