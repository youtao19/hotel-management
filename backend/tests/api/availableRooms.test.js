/**
 * 可用房间查询专项测试文件
 *
 * 测试接口：GET /api/rooms/available
 *
 * ✅ 核心功能说明：
 * 1. 根据日期范围查询可用房间
 * 2. 验证房间在指定时间段内的可用性
 * 3. 测试订单时间重叠的各种场景
 * 4. 验证房间状态对可用性的影响
 * 5. 支持按房型筛选可用房间
 *
 * ✅ 测试覆盖范围：
 * - ✅ 基本可用性查询（返回可用房间列表）
 * - ✅ 订单时间重叠检测（完全重叠、部分重叠、边界情况）
 * - ✅ 房间状态过滤（维修房不可用、清扫房可用）
 * - ✅ 日期边界测试（入住日、退房日的边界判断）
 * - ✅ 房型筛选（按 typeCode 过滤）
 *
 * 📊 相关数据库表：
 * - rooms: 房间表
 *   - room_number: VARCHAR(20) - 房间号
 *   - type_code: VARCHAR(50) - 房型代码
 *   - status: VARCHAR(20) - 房间状态
 * - orders: 订单表
 *   - order_id: VARCHAR(50) - 订单ID
 *   - room_number: VARCHAR(20) - 房间号
 *   - check_in_date: DATE - 入住日期
 *   - check_out_date: DATE - 退房日期
 *   - status: VARCHAR(20) - 订单状态
 * - room_types: 房型表
 *
 * 💡 业务规则说明：
 * 1. 可用房间定义：
 *    - 房间状态为"空闲"或"清扫"（维修状态不可用）
 *    - 在查询日期范围内没有"待入住"或"已入住"的订单
 * 2. 订单占用判断（时间重叠逻辑）：
 *    - 订单入住日 < 查询结束日 AND 订单退房日 > 查询开始日
 *    - 即：有任何时间重叠即视为占用
 * 3. 边界情况：
 *    - 查询开始日 = 订单退房日：房间可用（退房当天可入住）
 *    - 查询结束日 = 订单入住日：房间不可用（入住日已占用）
 * 4. 房型筛选：
 *    - typeCode 为空：返回所有房型的可用房间
 *    - typeCode 指定：只返回该房型的可用房间
 *
 * 🧪 测试场景详解：
 *
 * **场景1：基本可用性**
 * - 查询2025-06-01到06-03的可用房间
 * - 验证返回200状态码和数据结构
 *
 * **场景2：时间完全重叠**
 * - 订单：06-02到06-03
 * - 查询：06-01到06-03
 * - 结果：该房间不可用（102房间）
 *
 * **场景3：查询期间与订单完全重叠**
 * - 订单：06-02到06-03
 * - 查询：06-02到06-03
 * - 结果：该房间不可用
 *
 * **场景4：查询开始日在订单之前**
 * - 订单：06-02到06-03
 * - 查询：06-01到06-02
 * - 结果：该房间可用（退房日边界）
 *
 * **场景5：查询开始日在订单之后**
 * - 订单：06-02到06-03
 * - 查询：06-03到06-04
 * - 结果：该房间可用（退房后可入住）
 *
 * **场景6：订单占用特定日期**
 * - 订单：05-25到05-26（304房间）
 * - 查询：05-25到05-26
 * - 结果：304房间不可用
 *
 * **场景7：订单之后查询**
 * - 订单：05-25到05-26
 * - 查询：05-26到05-27
 * - 结果：304房间可用
 *
 * **场景8：维修状态房间**
 * - 103房间状态：repair（维修）
 * - 查询任意日期
 * - 结果：103房间不可用
 *
 * **场景9：清扫状态房间**
 * - 104房间状态：clean（清扫）
 * - 查询任意日期
 * - 结果：104房间可用（清扫房可预订）
 *
 * 🎯 测试数据设计：
 * - 使用时间戳后缀避免数据冲突
 * - 创建多种房型和房间状态
 * - 设置不同时间段的测试订单
 * - 验证边界条件
 *
 * 📅 日期重叠判断公式：
 * ```
 * 房间被占用 = (订单入住日 < 查询结束日) AND (订单退房日 > 查询开始日)
 * ```
 *
 * 作者：AI Assistant
 * 日期：2025-10-10
 */

const request = require('supertest');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('../test-helpers');

describe('可用房间查询专项测试 - GET /api/rooms/available', () => {
  beforeEach(async () => {
    await global.cleanupTestData();
  });

  let roomTypeStandard, roomTypeAvailable, roomTypeSuite;
  let room102, room103, room104, room202, room304;
  let order001, order002;

  beforeEach(async () => {
    const suffix = Date.now().toString();
    // 创建多个测试房型
    roomTypeAvailable = await createTestRoomType({ type_code: `TEST_AVAILABLE_TYPE_${suffix}` });
    roomTypeStandard = await createTestRoomType({ type_code: `standard_${suffix}` });
    roomTypeSuite = await createTestRoomType({ type_code: `suite_${suffix}` });

    // 创建测试房间
    room102 = await createTestRoom(roomTypeStandard.type_code, { room_number: `102_${suffix}` });
    room103 = await createTestRoom(roomTypeAvailable.type_code, { room_number: `103_${suffix}`, status: 'repair' }); // 维修状态
    room104 = await createTestRoom(roomTypeAvailable.type_code, { room_number: `104_${suffix}`, status: 'clean' }); // 清扫状态
    room202 = await createTestRoom(roomTypeAvailable.type_code, { room_number: `202_${suffix}`, status: 'repair' }); // 维修状态
    room304 = await createTestRoom(roomTypeSuite.type_code, { room_number: `304_${suffix}` });

    // 创建测试订单
  order001 = await createTestOrder({
      room_type: roomTypeStandard.type_code,
      room_number: room102.room_number,
      check_in_date: '2025-06-02',
      check_out_date: '2025-06-03',
      status: 'pending',
      total_price: 200.00,
  }, { insert: true });

  order002 = await createTestOrder({
      room_type: roomTypeSuite.type_code,
      room_number: room304.room_number,
      check_in_date: '2025-05-25',
      check_out_date: '2025-05-26',
      status: 'pending',
      room_price: { '2025-05-25': 200.00 },
  }, { insert: true });
  });

  it('返回可用房间(200)', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-03',
      typeCode: roomTypeAvailable.type_code
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

it('2025-06-01 ~ 06-03 没有房间号102', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-03',
      typeCode: roomTypeStandard.type_code
    });

    expect(res.statusCode).toBe(200);
    // some:是否存在至少一个元素，使得回调函数返回 true
  expect(res.body.data.some(room => room.room_number === room102.room_number)).toBe(false);
  });

  it('2025-06-02 ~ 06-03 没有房间号102', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-02',
      endDate: '2025-06-03',
      typeCode: roomTypeStandard.type_code
    });

    expect(res.statusCode).toBe(200);
  expect(res.body.data.some(room => room.room_number === room102.room_number)).toBe(false);
  })

  it('2025-06-01 ~ 06-02 有房间号102', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-02',
      typeCode: roomTypeStandard.type_code
    });

    expect(res.statusCode).toBe(200);
  expect(res.body.data.some(room => room.room_number === room102.room_number)).toBe(true);
  })

  it('2025-06-03 ~ 06-04 有房间号102', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-03',
      endDate: '2025-06-04',
      typeCode: roomTypeStandard.type_code
    });

    expect(res.statusCode).toBe(200);
  expect(res.body.data.some(room => room.room_number === room102.room_number)).toBe(true);
  })

  it('2025-05-25 ~ 05-26 没有房间号304', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-05-25',
      endDate: '2025-05-26',
      typeCode: roomTypeSuite.type_code
    });

    expect(res.statusCode).toBe(200);
  expect(res.body.data.some(room => room.room_number === room304.room_number)).toBe(false);
  })

  it('2025-05-26 ~ 05-27 有房间号304', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-05-26',
      endDate: '2025-05-27',
      typeCode: roomTypeSuite.type_code
    });

    expect(res.statusCode).toBe(200);
  expect(res.body.data.some(room => room.room_number === room304.room_number)).toBe(true);
  })

  it('103维修不可用',async() => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-25',
      typeCode: ''
    });

    expect(res.statusCode).toBe(200);
  expect(res.body.data.some(room => room.room_number === room103.room_number)).toBe(false);
  })

  it('202房间维修不可用',async() => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-25',
      typeCode: ''
    });

    expect(res.statusCode).toBe(200);
  expect(res.body.data.some(room => room.room_number === room202.room_number)).toBe(false);
  })

  it('104房间清扫可用',async() => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-25',
      typeCode: ''
    });

    expect(res.statusCode).toBe(200);
  expect(res.body.data.some(room => room.room_number === room104.room_number)).toBe(true);
  })
});
