const request = require('supertest');
const app = require('../app');
const { query } = require('../backend/database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('./test-helpers');

describe('GET /api/rooms/available', () => {
  beforeEach(global.cleanupTestData);

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
      room_price: { '2025-06-02': 200.00 },
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
