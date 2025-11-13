const app = require('../app');
const request = require('supertest');
const { query } = require('../database/postgreDB/pg');
const {roomTypes,addRoomType} = require('./tools');

describe('参数验证测试', () => {
  test('POST /api/room-types 缺少必填字段时返回 400', async () => {
    const invalidPayload = {
      type_code: 'INVALID'
    };

    const response = await request(app)
      .post('/api/room-types')
      .send(invalidPayload);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('请求数据格式错误');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  test('POST /api/room-types base_price 非数字时返回 400', async () => {
    const invalidPayload = {
      type_code: 'INVALID_PRICE',
      type_name: '测试房型',
      base_price: 'not-a-number',
      description: '测试描述'
    };

    const response = await request(app)
      .post('/api/room-types')
      .send(invalidPayload);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('请求数据格式错误');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  test('PUT /api/room-types/:code 包含额外字段时返回 400', async () => {
    const invalidPayload = {
      type_code: 'EXTRA_CODE',
      type_name: '测试房型',
      base_price: 200,
      description: '测试描述',
      extra_field: 'should be rejected'
    };

    const response = await request(app)
      .put('/api/room-types/EXTRA_CODE')
      .send(invalidPayload);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('请求数据格式错误');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });
});

describe('房型接口测试', () => {

  test('添加房型', async () => {
    const newRoomType = {
      type_code: 'DELUXE',
      type_name: '豪华房',
      base_price: 300,
      description: '宽敞舒适的豪华房'
    };

    const response = await request(app)
      .post('/api/room-types')
      .send(newRoomType);

    expect(response.statusCode).toBe(201);

    // 验证数据库中是否存在该房型
    const dbResponse = await query('SELECT * FROM room_types WHERE type_code = $1', [newRoomType.type_code]);
    expect(dbResponse.rows.length).toBe(1);
    expect(dbResponse.rows[0].type_name).toBe(newRoomType.type_name);
  });

  test('更新房型', async () => {
    const updatedRoomType = {
      type_code: 'DELUXE',
      type_name: '豪华海景房',
      base_price: 350,
      description: '享有海景的宽敞舒适豪华房'
    };

    const response = await request(app)
      .put('/api/room-types/DELUXE')
      .send(updatedRoomType);

    expect(response.statusCode).toBe(200);

    // 验证数据库中房型是否已更新
    const dbResponse = await query('SELECT * FROM room_types WHERE type_code = $1', ['DELUXE']);
    expect(dbResponse.rows.length).toBe(1);
    expect(dbResponse.rows[0].type_name).toBe(updatedRoomType.type_name);
  });

  test('删除房型', async () => {
    const response = await request(app)
      .delete('/api/room-types/DELUXE');

    expect(response.statusCode).toBe(200);

    // 验证数据库中房型是否已删除
    const dbResponse = await query('SELECT * FROM room_types WHERE type_code = $1', ['DELUXE']);
    expect(dbResponse.rows.length).toBe(0);
  });

  test('获取所有房型', async () => {
    await addRoomType(roomTypes);

    const response = await request(app)
      .get('/api/room-types/');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(roomTypes.length);
  });

  test('根据类型代码获取房型', async () => {
    const response = await request(app)
      .get('/api/room-types/asu_xiao_zhu');

    expect(response.statusCode).toBe(200);
    expect(response.body.data.type_code).toBe('asu_xiao_zhu');
    expect(response.body.data.type_name).toBe('阿苏晓筑');

    const response2 = await request(app)
      .get('/api/room-types/bo_ye_shuang');

    expect(response2.statusCode).toBe(200);
    expect(response2.body.data.type_code).toBe('bo_ye_shuang');
    expect(response2.body.data.type_name).toBe('泊野双床');

    const response3 = await request(app)
      .get('/api/room-types/zui_shan_tang');

    expect(response3.statusCode).toBe(200);
    expect(response3.body.data.type_code).toBe('zui_shan_tang');
    expect(response3.body.data.type_name).toBe('醉山塘');

    const response4 = await request(app)
      .get('/api/room-types/non_existent_code');

    expect(response4.statusCode).toBe(404);
    expect(response4.body.message).toBe('未找到房型');
  });

});
