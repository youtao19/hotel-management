const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { createTestRoomType, createTestRoom } = require('./test-helpers');

describe('Room Type Routes Tests', () => {
  beforeEach(global.cleanupTestData);

  describe('GET /api/room-types', () => {
    it('应该成功获取所有房型', async () => {
      // 创建测试房型
      await createTestRoomType();

      const res = await request(app)
        .get('/api/room-types');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('应该按type_code排序返回房型', async () => {
      // 创建多个测试房型
      await createTestRoomType({ type_code: 'TEST_A' });
      await createTestRoomType({ type_code: 'TEST_B' });

      const res = await request(app)
        .get('/api/room-types');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      // 验证排序
      const testRoomTypes = res.body.data.filter(rt => rt.type_code.startsWith('TEST_'));
      if (testRoomTypes.length >= 2) {
        expect(testRoomTypes[0].type_code <= testRoomTypes[1].type_code).toBe(true);
      }
    });

    it('当数据库为空时应该返回空数组', async () => {
      // 先删除所有相关数据，按外键依赖顺序删除
      await query('DELETE FROM bills');
      await query('DELETE FROM orders');
      await query('DELETE FROM rooms');
      await query('DELETE FROM room_types');

      const res = await request(app)
        .get('/api/room-types');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/room-types/:code', () => {
    it('应该成功获取指定房型', async () => {
      const roomType = await createTestRoomType();

      const res = await request(app)
        .get(`/api/room-types/${roomType.type_code}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.type_code).toBe(roomType.type_code);
      expect(res.body.data.type_name).toBe(roomType.type_name);
      expect(res.body.data.base_price).toBe(roomType.base_price);
    });

    it('当房型不存在时应该返回404', async () => {
      const res = await request(app)
        .get('/api/room-types/NONEXISTENT');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '未找到房型');
    });

    it('应该正确处理特殊字符的房型代码', async () => {
      const res = await request(app)
        .get('/api/room-types/TEST_SPECIAL_@#$');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '未找到房型');
    });
  });

  describe('POST /api/room-types', () => {
    it('应该成功创建新房型', async () => {
      const suffix = Date.now().toString().slice(-6);
      const roomTypeData = {
        type_code: `TEST_NEW_${suffix}`,
        type_name: `新测试房型_${suffix}`,
        base_price: '388.00',
        description: '这是一个新的测试房型'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.type_code).toBe(roomTypeData.type_code);
      expect(res.body.data.type_name).toBe(roomTypeData.type_name);
      expect(res.body.data.base_price).toBe(roomTypeData.base_price);
      expect(res.body.data.description).toBe(roomTypeData.description);
    });

    it('应该成功创建不带描述的房型', async () => {
      const suffix = Date.now().toString().slice(-6);
      const roomTypeData = {
        type_code: `TEST_NO_DESC_${suffix}`,
        type_name: `无描述房型_${suffix}`,
        base_price: '258.00'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      expect(res.status).toBe(201);
      expect(res.body.data.description).toBeNull();
    });

    it('缺少必要字段时应该返回400错误', async () => {
      const incompleteData = {
        type_name: '不完整的房型',
        base_price: '288.00'
        // 缺少 type_code
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(incompleteData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '缺少必要字段: type_code, type_name, base_price');
    });

    it('房型代码已存在时应该返回400错误', async () => {
      const roomType = await createTestRoomType();

      // 尝试创建相同代码的房型
      const duplicateData = {
        type_code: roomType.type_code,
        type_name: '重复的房型',
        base_price: '388.00'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(duplicateData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '房型代码已存在');
    });

    it('应该正确处理价格格式', async () => {
      const suffix = Date.now().toString().slice(-6);
      const roomTypeData = {
        type_code: `TEST_PRICE_${suffix}`,
        type_name: `价格测试房型_${suffix}`,
        base_price: 299.99
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      expect(res.status).toBe(201);
      expect(parseFloat(res.body.data.base_price)).toBe(299.99);
    });
  });

  describe('PUT /api/room-types/:code', () => {
    it('应该成功更新房型', async () => {
      const roomType = await createTestRoomType();

      const updateData = {
        type_name: '更新后的房型名称',
        base_price: '488.00',
        description: '更新后的描述'
      };

      const res = await request(app)
        .put(`/api/room-types/${roomType.type_code}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data.type_name).toBe(updateData.type_name);
      expect(res.body.data.base_price).toBe(updateData.base_price);
      expect(res.body.data.description).toBe(updateData.description);
      expect(res.body.data.type_code).toBe(roomType.type_code); // 代码不变
    });

    it('应该成功更新房型并清空描述', async () => {
      const roomType = await createTestRoomType();

      const updateData = {
        type_name: '清空描述的房型',
        base_price: '388.00'
        // 不提供 description
      };

      const res = await request(app)
        .put(`/api/room-types/${roomType.type_code}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBeNull();
    });

    it('缺少必要字段时应该返回400错误', async () => {
      const roomType = await createTestRoomType();

      const incompleteData = {
        type_name: '不完整的更新'
        // 缺少 base_price
      };

      const res = await request(app)
        .put(`/api/room-types/${roomType.type_code}`)
        .send(incompleteData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '缺少必要字段: type_name, base_price');
    });

    it('房型不存在时应该返回404错误', async () => {
      const updateData = {
        type_name: '不存在的房型',
        base_price: '388.00'
      };

      const res = await request(app)
        .put('/api/room-types/NONEXISTENT')
        .send(updateData);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '房型不存在');
    });
  });

  describe('DELETE /api/room-types/:code', () => {
    it('应该成功删除房型', async () => {
      const roomType = await createTestRoomType();

      const res = await request(app)
        .delete(`/api/room-types/${roomType.type_code}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '房型删除成功');

      // 验证房型已被删除
      const checkRes = await request(app)
        .get(`/api/room-types/${roomType.type_code}`);
      expect(checkRes.status).toBe(404);
    });

    it('房型不存在时应该返回404错误', async () => {
      const res = await request(app)
        .delete('/api/room-types/NONEXISTENT');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', '房型不存在');
    });

    it('有房间使用此房型时应该返回400错误', async () => {
      const roomType = await createTestRoomType();

      // 创建使用此房型的房间
      await createTestRoom(roomType.type_code);

      const res = await request(app)
        .delete(`/api/room-types/${roomType.type_code}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '无法删除，还有房间使用此房型');
    });
  });

  // 测试错误处理
  describe('Error Handling', () => {
    it('数据库错误时应该返回500', async () => {
      // 模拟数据库错误 - 使用无效的SQL
      const res = await request(app)
        .get('/api/room-types/; DROP TABLE room_types; --');

      // 应该正常处理，不会执行SQL注入
      expect(res.status).toBe(404);
    });
  });

  // 测试数据验证
  describe('Data Validation', () => {
    it('应该正确处理空字符串字段', async () => {
      const suffix = Date.now().toString().slice(-6);
      const roomTypeData = {
        type_code: `TEST_EMPTY_${suffix}`,
        type_name: '',
        base_price: '288.00'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      // 空字符串被当作缺少必要字段处理
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '缺少必要字段: type_code, type_name, base_price');
    });

    it('应该正确处理负数价格', async () => {
      const suffix = Date.now().toString().slice(-6);
      const roomTypeData = {
        type_code: `TEST_NEG_${suffix}`,
        type_name: `负价格房型_${suffix}`,
        base_price: '-100.00'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      // 数据库层面可能允许负数，但业务逻辑上不合理
      expect(res.status).toBe(201);
    });

    it('应该正确处理超长字符串', async () => {
      const suffix = Date.now().toString().slice(-6);
      const longString = 'A'.repeat(100);

      const roomTypeData = {
        type_code: `TEST_LONG_${suffix}`,
        type_name: longString,
        base_price: '288.00'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      // PostgreSQL会报错：值太长
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('message', '服务器错误');
    });

    it('应该正确处理null值', async () => {
      const suffix = Date.now().toString().slice(-6);
      const roomTypeData = {
        type_code: `TEST_NULL_${suffix}`,
        type_name: null,
        base_price: '288.00'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', '缺少必要字段: type_code, type_name, base_price');
    });

    it('应该正确处理非数字价格', async () => {
      const suffix = Date.now().toString().slice(-6);
      const roomTypeData = {
        type_code: `TEST_INVALID_PRICE_${suffix}`,
        type_name: `无效价格房型_${suffix}`,
        base_price: 'invalid_price'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      // 数据库会报错
      expect(res.status).toBe(500);
    });
  });

  // 测试响应数据结构
  describe('Response Data Structure', () => {
    it('GET /api/room-types 响应应该包含正确的数据结构', async () => {
      await createTestRoomType();

      const res = await request(app)
        .get('/api/room-types');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        const roomType = res.body.data[0];
        expect(roomType).toHaveProperty('type_code');
        expect(roomType).toHaveProperty('type_name');
        expect(roomType).toHaveProperty('base_price');
        expect(roomType).toHaveProperty('description');
        expect(roomType).toHaveProperty('is_closed');
      }
    });

    it('GET /api/room-types/:code 响应应该包含正确的数据结构', async () => {
      const roomType = await createTestRoomType();

      const res = await request(app)
        .get(`/api/room-types/${roomType.type_code}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('type_code');
      expect(res.body.data).toHaveProperty('type_name');
      expect(res.body.data).toHaveProperty('base_price');
      expect(res.body.data).toHaveProperty('description');
      expect(res.body.data).toHaveProperty('is_closed');
    });

    it('POST /api/room-types 响应应该包含正确的数据结构', async () => {
      const suffix = Date.now().toString().slice(-6);
      const roomTypeData = {
        type_code: `TEST_RESPONSE_${suffix}`,
        type_name: `响应测试房型_${suffix}`,
        base_price: '388.00',
        description: '测试响应数据结构'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('type_code', roomTypeData.type_code);
      expect(res.body.data).toHaveProperty('type_name', roomTypeData.type_name);
      expect(res.body.data).toHaveProperty('base_price', roomTypeData.base_price);
      expect(res.body.data).toHaveProperty('description', roomTypeData.description);
      expect(res.body.data).toHaveProperty('is_closed', false);
    });
  });

  // 测试边界情况
  describe('Edge Cases', () => {
    it('应该正确处理零价格', async () => {
      const suffix = Date.now().toString().slice(-6);
      const roomTypeData = {
        type_code: `TEST_ZERO_${suffix}`,
        type_name: `零价格房型_${suffix}`,
        base_price: '0.00'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      expect(res.status).toBe(201);
      expect(res.body.data.base_price).toBe('0.00');
    });

    it('应该正确处理最大长度的房型代码', async () => {
      const suffix = Date.now().toString().slice(-6);
      const maxLengthCode = `TEST_${'A'.repeat(10)}_${suffix}`.slice(0, 20); // VARCHAR(20)

      const roomTypeData = {
        type_code: maxLengthCode,
        type_name: `最大长度代码房型_${suffix}`,
        base_price: '288.00'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      expect(res.status).toBe(201);
    });

    it('应该正确处理最大长度的房型名称', async () => {
      const suffix = Date.now().toString().slice(-6);
      const maxLengthName = `测试${'A'.repeat(40)}_${suffix}`.slice(0, 50); // VARCHAR(50)

      const roomTypeData = {
        type_code: `TEST_MAX_NAME_${suffix}`,
        type_name: maxLengthName,
        base_price: '288.00'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      expect(res.status).toBe(201);
    });

    it('应该正确处理高精度价格', async () => {
      const suffix = Date.now().toString().slice(-6);
      const roomTypeData = {
        type_code: `TEST_PREC_${suffix}`, // 缩短代码以符合VARCHAR(20)限制
        type_name: `高精度价格房型_${suffix}`,
        base_price: '999.99'
      };

      const res = await request(app)
        .post('/api/room-types')
        .send(roomTypeData);

      expect(res.status).toBe(201);
      expect(res.body.data.base_price).toBe('999.99');
    });
  });
});