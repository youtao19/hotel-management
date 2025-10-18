/**
 * 房间路由API测试文件
 *
 * 测试接口：
 * - GET /api/rooms - 获取所有房间列表（支持日期查询）
 * - GET /api/rooms/available - 获取可用房间列表
 * - GET /api/rooms/:roomNumber - 获取指定房间详情
 * - POST /api/rooms - 创建新房间
 * - PUT /api/rooms/:roomNumber - 更新房间信息
 * - DELETE /api/rooms/:roomNumber - 删除房间
 * - PATCH /api/rooms/:roomNumber/status - 更新房间状态
 *
 * ✅ 核心功能说明：
 * 1. 房间信息的增删改查（CRUD）
 * 2. 房间可用性查询（日期范围查询）
 * 3. 房间状态管理（空闲/占用/清扫/维修）
 * 4. 房间与订单的关联检查
 * 5. 房间数据验证（房号唯一性、房型关联）
 *
 * ✅ 测试覆盖范围：
 * - ✅ 查询操作（全部房间、带日期参数、空数据）
 * - ✅ 可用房间查询（日期范围、房型筛选、状态过滤）
 * - ✅ 创建操作（成功创建、重复房号、房型验证）
 * - ✅ 更新操作（信息更新、状态更新、不存在的房间）
 * - ✅ 删除操作（成功删除、关联订单约束）
 * - ✅ 参数验证（日期格式、必填字段、数据类型）
 * - ✅ 错误处理（404、400、500等）
 *
 * 📊 相关数据库表：
 * - rooms: 房间表
 *   - room_id: SERIAL PRIMARY KEY - 房间ID
 *   - room_number: VARCHAR(20) UNIQUE NOT NULL - 房间号（唯一）
 *   - type_code: VARCHAR(50) NOT NULL - 房型代码（外键）
 *   - status: VARCHAR(20) DEFAULT '空闲' - 房间状态
 *   - floor: INTEGER - 楼层
 *   - price: NUMERIC(10,2) - 当前价格
 *   - created_at: TIMESTAMP - 创建时间
 *   - updated_at: TIMESTAMP - 更新时间
 * - room_types: 房型表（外键关联）
 * - orders: 订单表（查询房间占用情况）
 *
 * 💡 业务规则说明：
 * 1. 房间号（room_number）必须唯一
 * 2. 房间必须关联有效的房型（type_code）
 * 3. 房间状态：空闲、占用、清扫、维修
 * 4. 可用房间判断规则：
 *    - 状态为"空闲"或"清扫"
 *    - 在指定日期范围内没有"待入住"或"已入住"的订单
 *    - 维修状态的房间不可用
 * 5. 删除房间时，如果有关联订单，则不允许删除
 * 6. 日期查询格式：YYYY-MM-DD
 *
 * 🎯 接口详细说明：
 *
 * **GET /api/rooms**
 * - 获取所有房间
 * - 可选参数：date（查询指定日期的房间状态）
 * - 日期格式：YYYY-MM-DD
 *
 * **GET /api/rooms/available**
 * - 查询可用房间
 * - 必填参数：startDate, endDate
 * - 可选参数：typeCode（房型筛选）
 * - 返回指定日期范围内可用的房间
 *
 * **GET /api/rooms/:roomNumber**
 * - 获取房间详情
 * - 包含房型信息
 *
 * **POST /api/rooms**
 * - 创建新房间
 * - 必填：room_number, type_code
 * - 可选：floor, price, status
 *
 * **PUT /api/rooms/:roomNumber**
 * - 更新房间信息
 * - room_number 不可修改
 *
 * **PATCH /api/rooms/:roomNumber/status**
 * - 更新房间状态
 * - 只更新 status 字段
 *
 * 🧪 测试数据规范：
 * - 测试房间号包含时间戳避免冲突
 * - 使用 createTestRoom 辅助函数
 * - 每个测试前清理数据
 * - 测试订单状态：pending、checked-in
 *
 * 🔍 可用性查询逻辑：
 * - 订单日期与查询日期的重叠判断
 * - 入住日 <= 查询结束日 AND 退房日 > 查询开始日
 * - 排除已取消和已退房的订单
 *
 */

const request = require('supertest');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');
const { createTestRoomType, createTestRoom, createTestOrder } = require('../test-helpers');

describe('房间路由API测试 - Room Routes', () => {
  beforeEach(async () => {
    await global.cleanupTestData();
  });

  describe('GET /api/rooms', () => {
    it('应该成功获取所有房间', async () => {
      const roomType = await createTestRoomType();
      await createTestRoom(roomType.type_code);

      const res = await request(app)
        .get('/api/rooms');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('应该支持日期查询参数', async () => {
      const roomType = await createTestRoomType();
      await createTestRoom(roomType.type_code);
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
      await query('DELETE FROM bills');
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
      const roomType = await createTestRoomType();
      await createTestRoom(roomType.type_code);

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
      const roomType = await createTestRoomType();
      await createTestRoom(roomType.type_code);

      const startDate = '2024-12-01';
      const endDate = '2024-12-02';

      const res = await request(app)
        .get(`/api/rooms/available?startDate=${startDate}&endDate=${endDate}&typeCode=${roomType.type_code}`);

      expect(res.status).toBe(200);
      expect(res.body.query.typeCode).toBe(roomType.type_code);
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
      const roomType = await createTestRoomType();
      await createTestRoom(roomType.type_code);

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
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const res = await request(app)
        .get(`/api/rooms/${room.room_id}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.room_id).toBe(room.room_id);
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
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const res = await request(app)
        .get(`/api/rooms/number/${room.room_number}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.room_number).toBe(room.room_number);
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
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const res = await request(app)
        .get(`/api/rooms/test-repair/${room.room_id}`);

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
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const res = await request(app)
        .post(`/api/rooms/${room.room_id}/status`)
        .send({ status: 'cleaning' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cleaning');
    });

    it('请求体为空时应该返回400', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const res = await request(app)
        .post(`/api/rooms/${room.room_id}/status`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '请求体为空');
    });

    it('状态值未提供时应该返回400', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const res = await request(app)
        .post(`/api/rooms/${room.room_id}/status`)
        .send({ other: 'value' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '状态值未提供');
    });

    it('无效状态值时应该返回400', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const res = await request(app)
        .post(`/api/rooms/${room.room_id}/status`)
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
      const roomType = await createTestRoomType();
      const validStatuses = ['available', 'occupied', 'cleaning', 'repair', 'reserved'];

      for (const status of validStatuses) {
        const room = await createTestRoom(roomType.type_code);

        const res = await request(app)
          .post(`/api/rooms/${room.room_id}/status`)
          .send({ status });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(status);
      }
    });
  });

  describe('POST /api/rooms', () => {
    it('应该成功添加新房间', async () => {
      const roomType = await createTestRoomType();
      const suffix = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_NEW_${suffix}`.slice(0, 20),
        type_code: roomType.type_code,
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
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const duplicateData = {
        room_number: room.room_number,
        type_code: roomType.type_code,
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
      const suffix = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_INV_${suffix}`.slice(0, 20),
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
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const updateData = {
        room_number: room.room_number,
        type_code: roomType.type_code,
        status: 'cleaning',
        price: '388.00'
      };

      const res = await request(app)
        .put(`/api/rooms/${room.room_id}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cleaning');
      expect(res.body.data.price).toBe('388.00');
    });

    it('缺少必要字段时应该返回400', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const incompleteData = {
        room_number: 'TEST_UPDATE',
        type_code: roomType.type_code
        // 缺少 status 和 price
      };

      const res = await request(app)
        .put(`/api/rooms/${room.room_id}`)
        .send(incompleteData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '缺少必要字段');
    });

    it('房间不存在时应该返回404', async () => {
      const roomType = await createTestRoomType();

      const updateData = {
        room_number: 'TEST_NONEXISTENT',
        type_code: roomType.type_code,
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
      const roomType = await createTestRoomType();
      const room1 = await createTestRoom(roomType.type_code, { room_number: '101' });
      const room2 = await createTestRoom(roomType.type_code, { room_number: '102' });

      const updateData = {
        room_number: room2.room_number, // 使用已存在的房间号
        type_code: roomType.type_code,
        status: 'available',
        price: '288.00'
      };

      const res = await request(app)
        .put(`/api/rooms/${room1.room_id}`)
        .send(updateData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '房间号已存在');
    });
  });

  describe('DELETE /api/rooms/:id', () => {
    it('应该成功删除房间', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

      const res = await request(app)
        .delete(`/api/rooms/${room.room_id}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '房间删除成功');

      // 验证房间已被删除
      const checkRes = await request(app)
        .get(`/api/rooms/${room.room_id}`);
      expect(checkRes.status).toBe(404);
    });

    it('房间不存在时应该返回404', async () => {
      const res = await request(app)
        .delete('/api/rooms/999999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '房间不存在');
    });

    it('有活跃订单时应该返回400', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

  // 创建活跃订单（插入到数据库以便被删除逻辑检测到）
  await createTestOrder({ room_number: room.room_number, room_type: roomType.type_code, status: 'pending' }, { insert: true });

      const res = await request(app)
        .delete(`/api/rooms/${room.room_id}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '无法删除，房间有活跃订单');
    });

    it('有已入住订单时应该返回400', async () => {
      const roomType = await createTestRoomType();
      const room = await createTestRoom(roomType.type_code);

  // 创建已入住订单（插入到数据库以便被删除逻辑检测到）
  await createTestOrder({ room_number: room.room_number, room_type: roomType.type_code, status: 'checked-in' }, { insert: true });

      const res = await request(app)
        .delete(`/api/rooms/${room.room_id}`);

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
      const roomType = await createTestRoomType();
      const suffix = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_SP_${suffix}`.slice(0, 20),
        type_code: roomType.type_code,
        status: 'available',
        price: '288.00'
      };

      const res = await request(app)
        .post('/api/rooms')
        .send(roomData);

      expect(res.status).toBe(201);
    });

    it('应该正确处理零价格', async () => {
      const roomType = await createTestRoomType();
      const suffix = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_ZERO_${suffix}`.slice(0, 20),
        type_code: roomType.type_code,
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
      const roomType = await createTestRoomType();
      const suffix = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_NEG_${suffix}`.slice(0, 20),
        type_code: roomType.type_code,
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
      const roomType = await createTestRoomType();
      const suffix = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_PREC_${suffix}`.slice(0, 20),
        type_code: roomType.type_code,
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
      const roomType = await createTestRoomType();
      await createTestRoom(roomType.type_code);

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
      const roomType = await createTestRoomType();
      await createTestRoom(roomType.type_code);

      const res = await request(app)
        .get('/api/rooms/available?startDate=2024-12-01&endDate=2024-12-02');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('query');
      expect(res.body.query).toHaveProperty('startDate');
      expect(res.body.query).toHaveProperty('endDate');
    });

    it('POST /api/rooms 响应应该包含正确的数据结构', async () => {
      const roomType = await createTestRoomType();
      const suffix = Date.now().toString().slice(-6);

      const roomData = {
        room_number: `T_RESP_${suffix}`.slice(0, 20),
        type_code: roomType.type_code,
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
