const request = require('supertest');
const app = require('../app');
const { createTestRoomType, createTestRoom, createTestOrder } = require('./test-helpers');

describe('订单住宿类型功能测试', () => {
  describe('创建订单时自动设置stay_type', () => {
    test('应该为普通订单设置stay_type为"客房"', async () => {
      // 创建测试数据
      const roomType = await createTestRoomType({
        type_code: 'TEST_NORMAL_001',
        type_name: '测试标准间',
        base_price: 200
      });

      const room = await createTestRoom(roomType.type_code, {
        room_number: 'TEST_101_001'
      });

      const orderData = {
        order_id: 'TEST_NORMAL_ORDER_001',
        order_source: 'front_desk',
        guest_name: '张三',
        id_number: '123456789012345678',
        phone: '13800138000',
        check_in_date: '2025-09-10',
        check_out_date: '2025-09-12', // 两天，不是休息房
        status: 'pending',
        payment_method: 'cash',
        deposit: '100.00',
        remarks: '普通订单测试',
        room_type: roomType.type_code,
        room_number: room.room_number,
        room_price: {
          '2025-09-10': 200,
          '2025-09-11': 200
        }
      };

      const res = await request(app)
        .post('/api/orders/new')
        .send(orderData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.stay_type).toBe('客房');
    });

    test('应该为休息房订单设置stay_type为"休息房"', async () => {
      // 创建测试数据
      const roomType = await createTestRoomType({
        type_code: 'TEST_REST_001',
        type_name: '测试休息房',
        base_price: 150
      });

      const room = await createTestRoom(roomType.type_code, {
        room_number: 'TEST_201_001'
      });

      const orderData = {
        order_id: 'TEST_REST_ORDER_001',
        order_source: 'front_desk',
        guest_name: '李四',
        id_number: '123456789012345679',
        phone: '13800138001',
        check_in_date: '2025-09-10',
        check_out_date: '2025-09-10', // 同一天，是休息房
        status: 'pending',
        payment_method: 'cash',
        deposit: '50.00',
        remarks: '休息房订单测试',
        room_type: roomType.type_code,
        room_number: room.room_number,
        room_price: {
          '2025-09-10': 150
        }
      };

      const res = await request(app)
        .post('/api/orders/new')
        .send(orderData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.stay_type).toBe('休息房');
      // 验证休息房备注自动添加
      expect(res.body.data.order.remarks).toContain('【休息房】');
    });
  });

  describe('更新订单日期时重新计算stay_type', () => {
    test('应该在更新日期后重新计算stay_type', async () => {
      // 先创建一个普通订单（客房）
      const roomType = await createTestRoomType({
        type_code: 'TEST_UPDATE_001',
        type_name: '测试更新房',
        base_price: 180
      });

      const room = await createTestRoom(roomType.type_code, {
        room_number: 'TEST_301_001'
      });

      const orderData = {
        order_id: 'TEST_UPDATE_ORDER_001',
        order_source: 'front_desk',
        guest_name: '王五',
        id_number: '123456789012345680',
        phone: '13800138002',
        check_in_date: '2025-09-15',
        check_out_date: '2025-09-17', // 两天，客房
        status: 'pending',
        payment_method: 'cash',
        deposit: '100.00',
        remarks: '更新测试订单',
        room_type: roomType.type_code,
        room_number: room.room_number,
        room_price: {
          '2025-09-15': 180,
          '2025-09-16': 180
        }
      };

      // 创建订单
      const createRes = await request(app)
        .post('/api/orders/new')
        .send(orderData);

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.order.stay_type).toBe('客房');

      // 更新订单为同一天入住退房（变为休息房）
      const updateRes = await request(app)
        .put(`/api/orders/TEST_UPDATE_ORDER_001`)
        .send({
          check_out_date: '2025-09-15', // 改为同一天退房
          room_price: {
            '2025-09-15': 180
          }
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.stay_type).toBe('休息房');
    });
  });
});
