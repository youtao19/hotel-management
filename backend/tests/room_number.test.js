const app = require('../app');
const request = require('supertest');
const { query } = require('../database/postgreDB/pg');

const VALID_ROOM_STATES = ['available', 'occupied', 'cleaning', 'repair', 'reserved'];

describe('房间接口测试', () => {

  beforeAll(async () => {
    // 确保房型表中有一个房型用于测试房间添加
    await query(`
      INSERT INTO room_types (type_code, type_name, base_price)
      VALUES ('TEST_TYPE', '测试房型', 100)
      ON CONFLICT (type_code) DO NOTHING;
    `);
  });

  afterAll(async () => {
    // 清理测试数据
    await query(`DELETE FROM rooms WHERE type_code = 'TEST_TYPE';`);
    await query(`DELETE FROM room_types WHERE type_code = 'TEST_TYPE';`);
  });

  test('添加房间', async () => {
    const newRoom = {
      room_number: '101',
      type_code: 'TEST_TYPE',
      status: 'available',
      price: 150
    };

    const response = await request(app)
      .post('/api/rooms')
      .send(newRoom);

    expect(response.statusCode).toBe(201);
    expect(response.body.data).toHaveProperty('room_number', '101');
    expect(response.body.data).toHaveProperty('type_code', 'TEST_TYPE');
    expect(response.body.data).toHaveProperty('status', 'available');
  });

  test('更新房间信息', async () => {
    const updatedRoom = {
      room_number: '101',
      type_code: 'TEST_TYPE',
      status: 'occupied',
      price: 180
    };

    const response = await request(app)
      .put('/api/rooms/101')
      .send(updatedRoom);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'occupied');
    expect(parseFloat(response.body.data.price)).toBe(180);
  });



});

describe('更新房间状态' , () => {

  beforeAll(async () => {
    // 添加测试房间
    await query(`
      INSERT INTO room_types (type_code, type_name, base_price)
      VALUES ('TEST_TYPE', '测试房型', 100)
      ON CONFLICT (type_code) DO NOTHING;
    `);

    await query(`
      INSERT INTO rooms (room_number, type_code, status, price)
      VALUES ('101', 'TEST_TYPE', 'available', 150)
      ON CONFLICT (room_number) DO NOTHING;
    `);
  });

  beforeEach(async () => {
    // 每次测试前将房间状态重置为 available
    await query(`
      UPDATE rooms SET status = 'available' WHERE room_number = '101';
    `);
  });

  afterAll(async () => {
    // 清理测试数据
    await query(`DELETE FROM rooms WHERE room_number = '101';`);
    await query(`DELETE FROM room_types WHERE type_code = 'TEST_TYPE';`);
  });

  test('更新房间状态 - repair', async () => {
    const response = await request(app)
      .patch('/api/rooms/101/status')
      .send({ status: 'repair' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'repair');
  });

  test('更新房间状态 - cleaning', async () => {
    const response = await request(app)
      .patch('/api/rooms/101/status')
      .send({ status: 'cleaning' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'cleaning');
  });

  test('更新房间状态 - reserved', async () => {
    const response = await request(app)
      .patch('/api/rooms/101/status')
      .send({ status: 'reserved' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'reserved');
  });

  test('更新房间状态 - occupied', async () => {
    const response = await request(app)
      .patch('/api/rooms/101/status')
      .send({ status: 'occupied' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'occupied');
  });

  test('更新房间状态 - available', async () => {
    const response = await request(app)
      .patch('/api/rooms/101/status')
      .send({ status: 'available' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'available');
  });
});
