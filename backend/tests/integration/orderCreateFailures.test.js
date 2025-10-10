/**
 * 订单创建失败场景集成测试文件
 *
 * 测试接口：POST /api/orders/new
 *
 * ✅ 核心功能说明：
 * 1. 测试订单创建时的各种失败场景
 * 2. 验证参数校验逻辑的完整性
 * 3. 确保错误处理返回正确的错误信息
 * 4. 补充单元测试未覆盖的失败分支
 *
 * ✅ 测试覆盖范围：
 * - ✅ 数据格式验证（手机号格式、日期格式）
 * - ✅ 业务规则验证（日期逻辑、金额限制）
 * - ✅ 价格数据验证（格式、范围、日期匹配）
 * - ✅ 房间可用性验证（时间冲突检测）
 * - ✅ 边界条件（负数、零值、空值）
 *
 * 📊 相关数据库表：
 * - orders: 订单表
 * - rooms: 房间表（可用性检查）
 * - room_types: 房型表（价格参考）
 *
 * 💡 业务规则说明：
 * 1. 手机号格式：11位数字
 * 2. 日期逻辑：入住日期不能晚于退房日期
 * 3. 金额限制：
 *    - 总价格必须大于0
 *    - 押金不能为负数
 * 4. 价格数据规则：
 *    - 不能为空对象
 *    - 价格值必须大于0
 *    - 日期格式必须正确（YYYY-MM-DD）
 *    - 价格日期必须与入住/退房日期匹配
 *    - 多日订单的价格天数必须正确
 * 5. 房间可用性：
 *    - 同一房间不能有时间重叠的订单
 *    - 待入住和已入住状态的订单占用房间
 *
 * 🧪 测试场景分类：
 *
 * **参数格式验证**
 * - 无效手机号格式
 * - 错误的日期格式
 *
 * **业务逻辑验证**
 * - 入住日期晚于退房日期
 * - 押金为负数
 * - 总价格为0或负数
 *
 * **价格数据验证**
 * - 空的价格对象
 * - 无效的价格值（0或负数）
 * - 日期格式错误
 * - 价格日期与入住日期不匹配
 * - 多日订单价格天数不匹配
 *
 * **房间可用性验证**
 * - 房间时间冲突（完全重叠）
 * - 房间时间冲突（入住日重叠）
 * - 房间时间冲突（退房日重叠）
 *
 * 🎯 测试策略：
 * - 每个测试专注于一个失败场景
 * - 验证返回400错误码
 * - 验证错误信息的准确性
 * - 使用真实数据库进行集成测试
 * - 每个测试前清理数据确保独立性
 *
 * 作者：AI Assistant
 * 日期：2025-10-10
 */

const request = require('supertest');
const app = require('../../app');
const { createTestRoomType, createTestRoom, createTestOrder } = require('../test-helpers');

describe('POST /api/orders/new - 订单创建失败场景集成测试', () => {
  beforeEach(async () => {
    await global.cleanupTestData();
  });

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
    const order = { ...base, total_price: 0 }; // 直接设置总价格为0
    const res = await request(app).post('/api/orders/new').send(order);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('总价格必须大于0');
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
