// tests/availableRooms.test.js
const request = require('supertest');
const app = require('../app'); // 注意是 app，不是 server
const { initializeHotelDB, closePool, query } = require('../backend/database/postgreDB/pg');
// 确保订单中有 6.2 ~ 6.3  102房间
// 确保订单中有 5.25 ~ 5.26  304房间


const orderData1 = {
  order_id: 'TEST001',
  order_source: 'front_desk',
  guest_name: '张三',
  id_number: '123456789012345678',
  phone: '13800138000',
  room_type: 'standard', // 确保数据库有这个房型
  room_number: '102',  // 确保数据库有这个房间
  check_in_date: '2025-06-02T00:00:00.000Z',
  check_out_date: '2025-06-03T00:00:00.000Z',
  status: 'pending',
  payment_method: 'cash',
  room_price: '200.00',
  deposit: '100.00',
  create_time: '2025-06-02T00:00:00.000Z',
  remarks: '测试订单'
};

const orderData2 = {
  order_id: 'TEST002',
  order_source: 'front_desk',
  guest_name: '张三',
  id_number: '123456789012345678',
  phone: '13800138000',
  room_type: 'standard', // 确保数据库有这个房型
  room_number: '304',  // 确保数据库有这个房间
  check_in_date: '2025-05-25T00:00:00.000Z',
  check_out_date: '2025-05-26T00:00:00.000Z',
  status: 'pending',
  payment_method: 'cash',
  room_price: '200.00',
  deposit: '100.00',
  create_time: '2025-05-25T00:00:00.000Z',
  remarks: '测试订单'
};

describe('GET /api/rooms/available', () => {

  beforeAll(async () => {
    await initializeHotelDB();
    const res1 = request(app).post('/api/orders/new').send(orderData1);
    const res2 = request(app).post('/api/orders/new').send(orderData2);
    await Promise.all([res1, res2]);
  });

  // beforeEach(async () => {

  // });

  afterAll(async () => {
    await query('DELETE FROM orders');
    await closePool();
  });

  it('返回可用房间(200)', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-03',
      typeCode: 'standard'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('缺少参数应返回400', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01'
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('必须提供入住日期和退房日期');
  });

it('2025-06-01 ~ 06-03 没有房间号102', async () => {
  const res = await request(app).get('/api/rooms/available').query({
    startDate: '2025-06-01',
    endDate: '2025-06-03',
    typeCode: 'standard'
  });

    expect(res.statusCode).toBe(200);
    // some:是否存在至少一个元素，使得回调函数返回 true
    expect(res.body.data.some(room => room.room_number === '102')).toBe(false);
  });

  it('2025-06-02 ~ 06-03 没有房间号102', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-02',
      endDate: '2025-06-03',
      typeCode: 'standard'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some(room => room.room_number === '102')).toBe(false);
  })

  it('2025-06-01 ~ 06-02 有房间号102', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-02',
      typeCode: 'standard'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some(room => room.room_number === '102')).toBe(true);
  })

  it('2025-06-03 ~ 06-04 有房间号102', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-03',
      endDate: '2025-06-04',
      typeCode: 'standard'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some(room => room.room_number === '102')).toBe(true);
  })

  it('2025-05-25 ~ 05-26 没有房间号304', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-05-25',
      endDate: '2025-05-26',
      typeCode: 'standard'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some(room => room.room_number === '304')).toBe(false);
  })

  it('2025-05-26 ~ 05-27 有房间号304', async () => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-05-26',
      endDate: '2025-05-27',
      typeCode: 'suite'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some(room => room.room_number === '304')).toBe(true);
  })

  it('103维修不可用',async() => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-25',
      typeCode: ''
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some(room => room.room_number === '103')).toBe(false);
  })

  it('202房间维修不可用',async() => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-25',
      typeCode: ''
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some(room => room.room_number === '202')).toBe(false);
  })

  it('104房间清扫可用',async() => {
    const res = await request(app).get('/api/rooms/available').query({
      startDate: '2025-06-01',
      endDate: '2025-06-25',
      typeCode: ''
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some(room => room.room_number === '104')).toBe(true);
  })
});
