/**
 * 房间路由测试文件
 *
 * 测试覆盖范围：
 * - GET /api/rooms - 获取所有房间
 * - GET /api/rooms/available - 获取可用房间
 * - GET /api/rooms/:id - 获取指定房间
 * - GET /api/rooms/number/:number - 根据房间号获取房间
 * - GET /api/rooms/test-repair/:id - 测试维修端点
 * - POST /api/rooms/:id/status - 更新房间状态
 * - POST /api/rooms - 添加新房间
 * - PUT /api/rooms/:id - 更新房间信息
 * - DELETE /api/rooms/:id - 删除房间
 *
 * 测试内容包括：
 * - 正常功能测试
 * - 错误处理测试
 * - 数据验证测试
 * - 边界情况测试
 * - 响应数据结构验证
 */

const request = require('supertest');
const app = require('../app');
const { query } = require('../backend/database/postgreDB/pg');

describe('Room Routes Tests', () => {
  beforeEach(async () => {
    // 使用全局清理函数
    await global.cleanupTestData();

    // 等待一小段时间确保数据库操作完成
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  // 创建测试房型的辅助函数
  async function createTestRoomType(typeCode = 'TEST_STANDARD', typeName = '测试标准间', basePrice = '288.00') {
    const timestamp = Date.now().toString().slice(-6);
    const uniqueTypeCode = `${typeCode}_${timestamp}`;

    await query(
      'INSERT INTO room_types (type_code, type_name, base_price, description) VALUES ($1, $2, $3, $4)',
      [uniqueTypeCode, `${typeName}_${timestamp}`, basePrice, '测试房型描述']
    );

    return uniqueTypeCode;
  }

  // 创建测试房间的辅助函数
  async function createTestRoom(typeCode, roomNumber = '101', status = 'available', price = '288.00') {
    const timestamp = Date.now().toString().slice(-6);
    const uniqueRoomNumber = `T${roomNumber}_${timestamp}`.slice(0, 20); // 确保不超过VARCHAR(20)限制

    // 获取新的房间ID
    const idResult = await query('SELECT MAX(room_id) as max_id FROM rooms');
    const roomId = (idResult.rows[0].max_id || 0) + 1;

    await query(
      'INSERT INTO rooms (room_id, room_number, type_code, status, price) VALUES ($1, $2, $3, $4, $5)',
      [roomId, uniqueRoomNumber, typeCode, status, price]
    );

    return { roomId, roomNumber: uniqueRoomNumber };
  }

  // 创建测试订单的辅助函数
  async function createTestOrder(roomNumber, typeCode, orderId = null, status = 'pending') {
    const timestamp = Date.now().toString().slice(-6);
    const uniqueOrderId = orderId || `TEST_ORDER_${timestamp}`;
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await query(
      `INSERT INTO orders (order_id, order_source, guest_name, phone, id_number, room_type, room_number,
       check_in_date, check_out_date, status, room_price, deposit, create_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [uniqueOrderId, 'front_desk', `测试客人_${timestamp}`, `1380013${timestamp.slice(-4)}`,
       `12345678901234567${timestamp.slice(-1)}`, typeCode, roomNumber,
       today, tomorrow, status, '288.00', '100.00', new Date()]
    );

    return uniqueOrderId;
  }

  describe('GET /api/rooms', () => {
    it('应该成功获取所有房间', async () => {
      const typeCode = await createTestRoomType();
      await createTestRoom(typeCode);

      const res = await request(app)
        .get('/api/rooms');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('应该支持日期查询参数', async () => {
      const typeCode = await createTestRoomType();
      await createTestRoom(typeCode);
      const queryDate = '2024-01-01';

      const res = await request(app)
        .get(`/api/rooms?date=${queryDate}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('queryDate', queryDate);
      expect(res.body.message).toContain(queryDate);
    });

    it('日期格式错误时应该返回400', async () => {
      const res = await request(app)
        .get('/api/rooms?date=invalid-date');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '日期格式必须为 YYYY-MM-DD');
    });

    it('无效日期时应该返回400', async () => {
      const res = await request(app)
        .get('/api/rooms?date=2024-13-45');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '无效的日期');
    });

    it('当没有房间数据时应该返回空数组', async () => {
      // 清空所有房间数据
      await query('DELETE FROM orders');
      await query('DELETE FROM rooms');
      await query('DELETE FROM room_types');

      const res = await request(app)
        .get('/api/rooms');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.message).toBe('没有查询到房间数据');
    });
  });

  describe('GET /api/rooms/available', () => {
    it('应该成功获取可用房间', async () => {
      const typeCode = await createTestRoomType();
      await createTestRoom(typeCode);

      const startDate = '2024-12-01';
      const endDate = '2024-12-02';

      const res = await request(app)
        .get(`/api/rooms/available?startDate=${startDate}&endDate=${endDate}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('query');
      expect(res.body.query.startDate).toBe(startDate);
      expect(res.body.query.endDate).toBe(endDate);
    });

    it('应该支持房型过滤', async () => {
      const typeCode = await createTestRoomType();
      await createTestRoom(typeCode);

      const startDate = '2024-12-01';
      const endDate = '2024-12-02';

      const res = await request(app)
        .get(`/api/rooms/available?startDate=${startDate}&endDate=${endDate}&typeCode=${typeCode}`);

      expect(res.status).toBe(200);
      expect(res.body.query.typeCode).toBe(typeCode);
    });

    it('缺少日期参数时应该返回400', async () => {
      const res = await request(app)
        .get('/api/rooms/available?startDate=2024-12-01');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '必须提供入住日期和退房日期');
    });

    it('日期格式错误时应该返回400', async () => {
      const res = await request(app)
        .get('/api/rooms/available?startDate=invalid&endDate=2024-12-02');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '日期格式必须为 YYYY-MM-DD');
    });

    it('退房日期早于入住日期时应该返回400', async () => {
      const res = await request(app)
        .get('/api/rooms/available?startDate=2024-12-02&endDate=2024-12-01');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '退房日期不能早于入住日期');
    });

    it('应该支持同一天入住和退房（休息房）', async () => {
      const typeCode = await createTestRoomType();
      await createTestRoom(typeCode);

      const date = '2024-12-01';

      const res = await request(app)
        .get(`/api/rooms/available?startDate=${date}&endDate=${date}`);

      expect(res.status).toBe(200);
      expect(res.body.query.startDate).toBe(date);
      expect(res.body.query.endDate).toBe(date);
    });
  });

  describe('GET /api/rooms/:id', () => {
    it('应该成功获取指定房间', async () => {
      const typeCode = await createTestRoomType();
      const { roomId } = await createTestRoom(typeCode);

      const res = await request(app)
        .get(`/api/rooms/${roomId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.room_id).toBe(roomId);
    });

    it('房间不存在时应该返回404', async () => {
      const res = await request(app)
        .get('/api/rooms/999999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '未找到房间');
    });
  });

  describe('GET /api/rooms/number/:number', () => {
    it('应该成功根据房间号获取房间', async () => {
      const typeCode = await createTestRoomType();
      const { roomNumber } = await createTestRoom(typeCode);

      const res = await request(app)
        .get(`/api/rooms/number/${roomNumber}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.room_number).toBe(roomNumber);
    });

    it('房间号不存在时应该返回404', async () => {
      const res = await request(app)
        .get('/api/rooms/number/NONEXISTENT');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '未找到房间');
    });
  });

  describe('GET /api/rooms/test-repair/:id', () => {
    it('应该成功设置房间为维修状态', async () => {
      const typeCode = await createTestRoomType();
      const { roomId } = await createTestRoom(typeCode);

      const res = await request(app)
        .get(`/api/rooms/test-repair/${roomId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '房间状态已更新为维修');
      expect(res.body.data.status).toBe('repair');
    });

    it('房间不存在时应该返回404', async () => {
      const res = await request(app)
        .get('/api/rooms/test-repair/999999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '未找到房间');
    });
  });

  describe('POST /api/rooms/:id/status', () => {
    it('应该成功更新房间状态', async () => {
      const typeCode = await createTestRoomType();
      const { roomId } = await createTestRoom(typeCode);

      const res = await request(app)
        .post(`/api/rooms/${roomId}/status`)
        .send({ status: 'cleaning' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cleaning');
    });

    it('请求体为空时应该返回400', async () => {
      const typeCode = await createTestRoomType();
      const { roomId } = await createTestRoom(typeCode);

      const res = await request(app)
        .post(`/api/rooms/${roomId}/status`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '请求体为空');
    });

    it('状态值未提供时应该返回400', async () => {
      const typeCode = await createTestRoomType();
      const { roomId } = await createTestRoom(typeCode);

      const res = await request(app)
        .post(`/api/rooms/${roomId}/status`)
        .send({ other: 'value' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '状态值未提供');
    });

    it('无效状态值时应该返回400', async () => {
      const typeCode = await createTestRoomType();
      const { roomId } = await createTestRoom(typeCode);

      const res = await request(app)
        .post(`/api/rooms/${roomId}/status`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '无效的房间状态');
      expect(res.body).toHaveProperty('validStatuses');
    });

    it('房间不存在时应该返回404', async () => {
      const res = await request(app)
        .post('/api/rooms/999999/status')
        .send({ status: 'cleaning' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '未找到房间');
    });

    it('应该支持所有有效的房间状态', async () => {
      const typeCode = await createTestRoomType();
      const validStatuses = ['available', 'occupied', 'cleaning', 'repair', 'reserved'];

      for (const status of validStatuses) {
        const { roomId } = await createTestRoom(typeCode);

        const res = await request(app)
          .post(`/api/rooms/${roomId}/status`)
          .send({ status });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(status);
      }
    });
  });

  describe('POST /api/rooms', () => {
    it('应该成功添加新房间', async () => {
      const typeCode = await createTestRoomType();
      const timestamp = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_NEW_${timestamp}`.slice(0, 20),
        type_code: typeCode,
        status: 'available',
        price: '388.00'
      };

      const res = await request(app)
        .post('/api/rooms')
        .send(roomData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.room_number).toBe(roomData.room_number);
      expect(res.body.data.type_code).toBe(roomData.type_code);
      expect(res.body.data.status).toBe(roomData.status);
      expect(res.body.data.price).toBe(roomData.price);
    });

    it('缺少必要字段时应该返回400', async () => {
      const incompleteData = {
        room_number: 'TEST_INCOMPLETE',
        type_code: 'TEST_TYPE'
        // 缺少 status 和 price
      };

      const res = await request(app)
        .post('/api/rooms')
        .send(incompleteData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '缺少必要字段');
    });

    it('房间号已存在时应该返回400', async () => {
      const typeCode = await createTestRoomType();
      const { roomNumber } = await createTestRoom(typeCode);

      const duplicateData = {
        room_number: roomNumber,
        type_code: typeCode,
        status: 'available',
        price: '288.00'
      };

      const res = await request(app)
        .post('/api/rooms')
        .send(duplicateData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '房间号已存在');
    });

    it('房型不存在时应该返回500错误', async () => {
      const timestamp = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_INV_${timestamp}`.slice(0, 20),
        type_code: 'NONEXISTENT_TYPE',
        status: 'available',
        price: '288.00'
      };

      const res = await request(app)
        .post('/api/rooms')
        .send(roomData);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('message', '服务器错误');
    });
  });

  describe('PUT /api/rooms/:id', () => {
    it('应该成功更新房间信息', async () => {
      const typeCode = await createTestRoomType();
      const { roomId, roomNumber } = await createTestRoom(typeCode);

      const updateData = {
        room_number: roomNumber,
        type_code: typeCode,
        status: 'cleaning',
        price: '388.00'
      };

      const res = await request(app)
        .put(`/api/rooms/${roomId}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cleaning');
      expect(res.body.data.price).toBe('388.00');
    });

    it('缺少必要字段时应该返回400', async () => {
      const typeCode = await createTestRoomType();
      const { roomId } = await createTestRoom(typeCode);

      const incompleteData = {
        room_number: 'TEST_UPDATE',
        type_code: typeCode
        // 缺少 status 和 price
      };

      const res = await request(app)
        .put(`/api/rooms/${roomId}`)
        .send(incompleteData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '缺少必要字段');
    });

    it('房间不存在时应该返回404', async () => {
      const typeCode = await createTestRoomType();

      const updateData = {
        room_number: 'TEST_NONEXISTENT',
        type_code: typeCode,
        status: 'available',
        price: '288.00'
      };

      const res = await request(app)
        .put('/api/rooms/999999')
        .send(updateData);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '房间不存在');
    });

    it('更新房间号为已存在的房间号时应该返回400', async () => {
      const typeCode = await createTestRoomType();
      const { roomId: roomId1 } = await createTestRoom(typeCode, '101');
      const { roomNumber: roomNumber2 } = await createTestRoom(typeCode, '102');

      const updateData = {
        room_number: roomNumber2, // 使用已存在的房间号
        type_code: typeCode,
        status: 'available',
        price: '288.00'
      };

      const res = await request(app)
        .put(`/api/rooms/${roomId1}`)
        .send(updateData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '房间号已存在');
    });
  });

  describe('DELETE /api/rooms/:id', () => {
    it('应该成功删除房间', async () => {
      const typeCode = await createTestRoomType();
      const { roomId, roomNumber } = await createTestRoom(typeCode);

      const res = await request(app)
        .delete(`/api/rooms/${roomId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '房间删除成功');

      // 验证房间已被删除
      const checkRes = await request(app)
        .get(`/api/rooms/${roomId}`);
      expect(checkRes.status).toBe(404);
    });

    it('房间不存在时应该返回404', async () => {
      const res = await request(app)
        .delete('/api/rooms/999999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '房间不存在');
    });

    it('有活跃订单时应该返回400', async () => {
      const typeCode = await createTestRoomType();
      const { roomId, roomNumber } = await createTestRoom(typeCode);

      // 创建活跃订单
      await createTestOrder(roomNumber, typeCode, null, 'pending');

      const res = await request(app)
        .delete(`/api/rooms/${roomId}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '无法删除，房间有活跃订单');
    });

    it('有已入住订单时应该返回400', async () => {
      const typeCode = await createTestRoomType();
      const { roomId, roomNumber } = await createTestRoom(typeCode);

      // 创建已入住订单
      await createTestOrder(roomNumber, typeCode, null, 'checked-in');

      const res = await request(app)
        .delete(`/api/rooms/${roomId}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '无法删除，房间有活跃订单');
    });
  });

  // 测试错误处理
  describe('Error Handling', () => {
    it('数据库错误时应该返回500', async () => {
      // 模拟数据库错误 - 使用无效的房间ID格式
      const res = await request(app)
        .get('/api/rooms/invalid_id_format');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('message', '服务器错误');
    });
  });

  // 测试数据验证
  describe('Data Validation', () => {
    it('应该正确处理特殊字符的房间号', async () => {
      const typeCode = await createTestRoomType();
      const timestamp = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_SP_${timestamp}`.slice(0, 20), // 确保不超过VARCHAR(20)限制
        type_code: typeCode,
        status: 'available',
        price: '288.00'
      };

      const res = await request(app)
        .post('/api/rooms')
        .send(roomData);

      expect(res.status).toBe(201);
    });

    it('应该正确处理零价格', async () => {
      const typeCode = await createTestRoomType();
      const timestamp = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_ZERO_${timestamp}`.slice(0, 20),
        type_code: typeCode,
        status: 'available',
        price: '0.00'
      };

      const res = await request(app)
        .post('/api/rooms')
        .send(roomData);

      expect(res.status).toBe(201);
      expect(res.body.data.price).toBe('0.00');
    });

    it('应该正确处理负数价格', async () => {
      const typeCode = await createTestRoomType();
      const timestamp = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_NEG_${timestamp}`.slice(0, 20),
        type_code: typeCode,
        status: 'available',
        price: '-100.00'
      };

      const res = await request(app)
        .post('/api/rooms')
        .send(roomData);

      expect(res.status).toBe(201);
      expect(res.body.data.price).toBe('-100.00');
    });

    it('应该正确处理高精度价格', async () => {
      const typeCode = await createTestRoomType();
      const timestamp = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_PREC_${timestamp}`.slice(0, 20),
        type_code: typeCode,
        status: 'available',
        price: '999.99'
      };

      const res = await request(app)
        .post('/api/rooms')
        .send(roomData);

      expect(res.status).toBe(201);
      expect(res.body.data.price).toBe('999.99');
    });
  });

  // 测试响应数据结构
  describe('Response Data Structure', () => {
    it('GET /api/rooms 响应应该包含正确的数据结构', async () => {
      const typeCode = await createTestRoomType();
      await createTestRoom(typeCode);

      const res = await request(app)
        .get('/api/rooms');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        const room = res.body.data[0];
        expect(room).toHaveProperty('room_id');
        expect(room).toHaveProperty('room_number');
        expect(room).toHaveProperty('type_code');
        expect(room).toHaveProperty('status');
        expect(room).toHaveProperty('price');
      }
    });

    it('GET /api/rooms/available 响应应该包含正确的数据结构', async () => {
      const typeCode = await createTestRoomType();
      await createTestRoom(typeCode);

      const res = await request(app)
        .get('/api/rooms/available?startDate=2024-12-01&endDate=2024-12-02');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('query');
      expect(res.body.query).toHaveProperty('startDate');
      expect(res.body.query).toHaveProperty('endDate');
    });

    it('POST /api/rooms 响应应该包含正确的数据结构', async () => {
      const typeCode = await createTestRoomType();
      const timestamp = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_RESP_${timestamp}`.slice(0, 20),
        type_code: typeCode,
        status: 'available',
        price: '388.00'
      };

      const res = await request(app)
        .post('/api/rooms')
        .send(roomData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('room_id');
      expect(res.body.data).toHaveProperty('room_number', roomData.room_number);
      expect(res.body.data).toHaveProperty('type_code', roomData.type_code);
      expect(res.body.data).toHaveProperty('status', roomData.status);
      expect(res.body.data).toHaveProperty('price', roomData.price);
    });
  });
});
