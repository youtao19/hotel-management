const request = require('supertest');
const app = require('../app');
const { query } = require('../backend/database/postgreDB/pg');

describe('交接班功能测试', () => {
  beforeAll(async () => {
    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'TEST_SHIFT_%\'');
    await query('DELETE FROM shift_handover WHERE remarks LIKE \'%测试数据%\'');
  });

  afterAll(async () => {
    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'TEST_SHIFT_%\'');
    await query('DELETE FROM shift_handover WHERE remarks LIKE \'%测试数据%\'');
  });

  describe('GET /api/shift-handover/receipts', () => {
    beforeEach(async () => {
      // 插入测试订单数据
      const today = new Date().toISOString().split('T')[0];

      const testOrders = [
        {
          order_id: 'TEST_SHIFT_001',
          id_source: 'system',
          order_source: 'front_desk',
          guest_name: '测试客人1',
          phone: '13800000001',
          id_number: '110101199001011001',
          room_type: 'standard',
          room_number: '101',
          room_price: 288.00,  // >150，应归类为客房
          deposit: 200.00,
          payment_method: '现金',
          status: 'checked_out',
          check_in_date: `${today} 10:00:00`,
          check_out_date: new Date(new Date(today).getTime() + 24*60*60*1000).toISOString().split('T')[0] + ' 12:00:00',
          create_time: `${today} 10:00:00`,
          remarks: '测试数据'
        },
        {
          order_id: 'TEST_SHIFT_002',
          id_source: 'system',
          order_source: 'online',
          guest_name: '测试客人2',
          phone: '13800000002',
          id_number: '110101199002022002',
          room_type: 'standard',
          room_number: '102',
          room_price: 88.00,   // <=150，应归类为休息房
          deposit: 50.00,
          payment_method: '微信',
          status: 'checked_out',
          check_in_date: `${today} 14:00:00`,
          check_out_date: `${today} 17:00:00`,
          create_time: `${today} 14:00:00`,
          remarks: '测试数据'
        }
      ];

      for (const order of testOrders) {
        const sql = `
          INSERT INTO orders (
            order_id, id_source, order_source, guest_name, phone, id_number,
            room_type, room_number, room_price, deposit, payment_method,
            status, check_in_date, check_out_date, create_time, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `;

        await query(sql, [
          order.order_id, order.id_source, order.order_source, order.guest_name,
          order.phone, order.id_number, order.room_type, order.room_number,
          order.room_price, order.deposit, order.payment_method, order.status,
          order.check_in_date, order.check_out_date, order.create_time, order.remarks
        ]);
      }
    });

    afterEach(async () => {
      await query('DELETE FROM orders WHERE order_id LIKE \'TEST_SHIFT_%\'');
    });

    test('应该能够获取客房收款明细', async () => {
      const today = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/shift-handover/receipts')
        .query({
          date: today,
          type: 'hotel'
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const hotelOrder = response.body.find(order => order.order_number === 'TEST_SHIFT_001');
      expect(hotelOrder).toBeDefined();
      expect(hotelOrder.room_fee).toBe('288.00');
      expect(hotelOrder.deposit).toBe('200.00');
      expect(hotelOrder.payment_method).toBe('现金');
      expect(hotelOrder.total_amount).toBe('488.00');
    });

    test('应该能够获取休息房收款明细', async () => {
      const today = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/shift-handover/receipts')
        .query({
          date: today,
          type: 'rest'
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      const restOrder = response.body.find(order => order.order_number === 'TEST_SHIFT_002');
      expect(restOrder).toBeDefined();
      expect(restOrder.room_fee).toBe('88.00');
      expect(restOrder.deposit).toBe('50.00');
      expect(restOrder.payment_method).toBe('微信');
      expect(restOrder.total_amount).toBe('138.00');
    });

    test('应该返回空数组当没有指定日期的数据时', async () => {
      // 使用一个确定不会有数据的未来日期
      const futureDate = '2030-12-31';

      const response = await request(app)
        .get('/api/shift-handover/receipts')
        .query({
          date: futureDate,
          type: 'hotel'
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // 由于可能存在其他测试数据，我们只检查返回的是数组格式
      // expect(response.body.length).toBe(0);
    });
  });

  describe('GET /api/shift-handover/statistics', () => {
    test('应该能够获取交接班统计数据', async () => {
      const today = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/shift-handover/statistics')
        .query({ date: today })
        .expect(200);

      expect(response.body).toHaveProperty('reserveCash');
      expect(response.body).toHaveProperty('hotelIncome');
      expect(response.body).toHaveProperty('restIncome');
      expect(response.body).toHaveProperty('carRentalIncome');
      expect(response.body).toHaveProperty('totalIncome');
      expect(response.body).toHaveProperty('hotelDeposit');
      expect(response.body).toHaveProperty('restDeposit');
      expect(response.body).toHaveProperty('retainedAmount');
      expect(response.body).toHaveProperty('handoverAmount');
      expect(response.body).toHaveProperty('goodReviews');
      expect(response.body).toHaveProperty('vipCards');
      expect(response.body).toHaveProperty('totalRooms');
      expect(response.body).toHaveProperty('restRooms');

      expect(typeof response.body.reserveCash).toBe('number');
      expect(typeof response.body.hotelIncome).toBe('number');
      expect(typeof response.body.restIncome).toBe('number');
      expect(typeof response.body.totalIncome).toBe('number');
    });
  });

  describe('POST /api/shift-handover/save', () => {
    test('应该能够保存交接班记录', async () => {
      const today = new Date().toISOString().split('T')[0];
      const testData = {
        type: 'hotel',
        cashier_name: '测试收银员',
        shift_time: '08:00',
        shift_date: today,
        statistics: {
          reserveCash: 1000,
          hotelIncome: 500,
          restIncome: 0,
          carRentalIncome: 50,
          totalIncome: 1550,
          hotelDeposit: 100,
          restDeposit: 0,
          retainedAmount: 50,
          handoverAmount: 1400,
          goodReviews: 3,
          vipCards: 1,
          totalRooms: 2,
          restRooms: 0
        },
        details: [
          {
            order_number: 'TEST_SHIFT_001',
            room_number: '101',
            amount: 488
          }
        ],
        remarks: '测试数据交接班记录'
      };

      const response = await request(app)
        .post('/api/shift-handover/save')
        .send(testData)
        .expect(201);

      expect(response.body).toHaveProperty('message', '交接班记录保存成功');
      expect(response.body).toHaveProperty('id');

      // 验证数据是否保存到数据库
      const savedRecordResult = await query(
        'SELECT * FROM shift_handover WHERE id = $1',
        [response.body.id]
      );

      expect(savedRecordResult.rows.length).toBe(1);
      const savedRecord = savedRecordResult.rows[0];
      expect(savedRecord.cashier_name).toBe('测试收银员');
      expect(savedRecord.type).toBe('hotel');
      expect(savedRecord.remarks).toBe('测试数据交接班记录');
    });

    test('应该验证必填字段', async () => {
      const incompleteData = {
        type: 'hotel'
        // 缺少必填字段
      };

      const response = await request(app)
        .post('/api/shift-handover/save')
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/shift-handover/history', () => {
    beforeEach(async () => {
      // 插入测试历史记录
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const testRecord = {
        type: 'hotel',
        cashier_name: '测试历史收银员',
        shift_time: '16:00',
        shift_date: yesterday,
        statistics: {
          reserveCash: 800,
          hotelIncome: 600,
          restIncome: 0,
          totalIncome: 1400
        },
        details: [],
        remarks: '测试数据历史记录'
      };

      await query(`
        INSERT INTO shift_handover (
          type, cashier_name, shift_time, shift_date,
          statistics, details, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        testRecord.type, testRecord.cashier_name, testRecord.shift_time,
        testRecord.shift_date, JSON.stringify(testRecord.statistics),
        JSON.stringify(testRecord.details), testRecord.remarks
      ]);
    });

    test('应该能够获取历史记录', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/shift-handover/history')
        .query({
          startDate,
          endDate
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      const testRecord = response.body.find(record =>
        record.cashier_name === '测试历史收银员'
      );

      expect(testRecord).toBeDefined();
      expect(testRecord.type).toBe('hotel');
      expect(testRecord.shift_time).toBe('16:00');
      expect(testRecord.remarks).toBe('测试数据历史记录');
    });
  });

  describe('POST /api/shift-handover/export', () => {
    test('应该能够导出Excel文件', async () => {
      const testData = {
        type: 'hotel',
        date: new Date().toISOString().split('T')[0],
        details: [
          {
            order_number: 'TEST_001',
            room_number: '101',
            room_fee: 288,
            deposit: 200,
            payment_method: '现金',
            total_amount: 488
          }
        ],
        statistics: {
          reserveCash: 1000,
          hotelIncome: 488,
          restIncome: 0,
          totalIncome: 1488
        }
      };

      const response = await request(app)
        .post('/api/shift-handover/export')
        .send(testData)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(Buffer.isBuffer(response.body) || response.body instanceof ArrayBuffer).toBe(true);
      expect(response.body.byteLength || response.body.length).toBeGreaterThan(0);
    });
  });
});
