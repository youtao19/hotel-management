const request = require('supertest');
const app = require('../app');
const { query } = require('../backend/database/postgreDB/pg');

describe('交接班功能集成测试', () => {
  let testHandoverId;

  beforeAll(async () => {
    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'INTEGRATION_%\'');
    await query('DELETE FROM shift_handover WHERE remarks LIKE \'%集成测试%\'');
  });

  afterAll(async () => {
    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'INTEGRATION_%\'');
    await query('DELETE FROM shift_handover WHERE remarks LIKE \'%集成测试%\'');
  });

  describe('完整的交接班流程测试', () => {
    test('应该能够完成完整的交接班流程', async () => {
      const today = new Date().toISOString().split('T')[0];

      // 1. 首先创建一些订单数据
      const testOrders = [
        {
          order_id: 'INTEGRATION_001',
          id_source: 'system',
          order_source: 'front_desk',
          guest_name: '集成测试客人1',
          phone: '13700000001',
          id_number: '110101199001011001',
          room_type: 'standard',
          room_number: '101',
          room_price: 288.00,
          deposit: 200.00,
          payment_method: '现金',
          status: 'checked_out',
          check_in_date: today,
          check_out_date: today,
          create_time: `${today} 14:30:00`,
          remarks: '集成测试数据'
        },
        {
          order_id: 'INTEGRATION_002',
          id_source: 'system',
          order_source: 'online',
          guest_name: '集成测试客人2',
          phone: '13700000002',
          id_number: '110101199002022002',
          room_type: 'deluxe',
          room_number: '105',
          room_price: 388.00,
          deposit: 300.00,
          payment_method: '微信',
          status: 'checked_out',
          check_in_date: today,
          check_out_date: today,
          create_time: `${today} 16:15:00`,
          remarks: '集成测试数据'
        },
        {
          order_id: 'INTEGRATION_003',
          id_source: 'system',
          order_source: 'phone',
          guest_name: '集成测试客人3',
          phone: '13700000003',
          id_number: '110101199003033003',
          room_type: 'rest',
          room_number: '201',
          room_price: 88.00,
          deposit: 50.00,
          payment_method: '支付宝',
          status: 'checked_out',
          check_in_date: today,
          check_out_date: today,
          create_time: `${today} 18:20:00`,
          remarks: '集成测试数据'
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

      // 2. 获取客房收款明细
      const hotelReceiptsResponse = await request(app)
        .get('/api/shift-handover/receipts')
        .query({ date: today, type: 'hotel' })
        .expect(200);

      expect(hotelReceiptsResponse.body.length).toBeGreaterThanOrEqual(2);

      const hotelTotal = hotelReceiptsResponse.body.reduce((sum, receipt) =>
        sum + parseFloat(receipt.total_amount), 0
      );
      expect(hotelTotal).toBeGreaterThanOrEqual(688); // At least the high-value order

      // 3. 获取休息房收款明细
      const restReceiptsResponse = await request(app)
        .get('/api/shift-handover/receipts')
        .query({ date: today, type: 'rest' })
        .expect(200);

      expect(restReceiptsResponse.body.length).toBeGreaterThanOrEqual(1);

      const restTotal = restReceiptsResponse.body.reduce((sum, receipt) =>
        sum + parseFloat(receipt.total_amount), 0
      );
      expect(restTotal).toBe(138); // 88+50 = 138

      // 4. 获取统计数据
      const statisticsResponse = await request(app)
        .get('/api/shift-handover/statistics')
        .query({ date: today })
        .expect(200);      const stats = statisticsResponse.body;
      expect(stats.hotelIncome).toBeGreaterThanOrEqual(688); // At least one hotel order
      expect(stats.restIncome).toBeGreaterThanOrEqual(138);
      expect(stats.totalRooms).toBeGreaterThanOrEqual(2);
      expect(stats.restRooms).toBeGreaterThanOrEqual(1);

      // 5. 保存交接班记录
      const handoverData = {
        type: 'hotel',
        cashier_name: '集成测试收银员',
        shift_time: '20:00',
        shift_date: today,
        statistics: {
          reserveCash: 1000,
          hotelIncome: stats.hotelIncome,
          restIncome: stats.restIncome,
          carRentalIncome: 100,
          totalIncome: stats.hotelIncome + stats.restIncome + 1100,
          hotelDeposit: 200,
          restDeposit: 50,
          retainedAmount: 100,
          handoverAmount: stats.hotelIncome + stats.restIncome + 1100 - 350,
          goodReviews: 5,
          vipCards: 2,
          totalRooms: stats.totalRooms,
          restRooms: stats.restRooms
        },
        details: [...hotelReceiptsResponse.body, ...restReceiptsResponse.body],
        remarks: '集成测试完整流程交接班记录'
      };

      const saveResponse = await request(app)
        .post('/api/shift-handover/save')
        .send(handoverData)
        .expect(201);

      expect(saveResponse.body).toHaveProperty('message', '交接班记录保存成功');
      expect(saveResponse.body).toHaveProperty('id');
      testHandoverId = saveResponse.body.id;

      // 6. 验证保存的数据
      const savedRecord = await query(
        'SELECT * FROM shift_handover WHERE id = $1',
        [testHandoverId]
      );      expect(savedRecord.rows.length).toBe(1);
      expect(savedRecord.rows[0].cashier_name).toBe('集成测试收银员');
      expect(savedRecord.rows[0].type).toBe('hotel');
      expect(savedRecord.rows[0].remarks).toBe('集成测试完整流程交接班记录');

      const savedStatistics = typeof savedRecord.rows[0].statistics === 'string'
        ? JSON.parse(savedRecord.rows[0].statistics)
        : savedRecord.rows[0].statistics;

      expect(savedStatistics.hotelIncome).toBe(stats.hotelIncome);
      expect(savedStatistics.restIncome).toBe(stats.restIncome);
      expect(savedStatistics.totalRooms).toBe(stats.totalRooms);
      expect(savedStatistics.restRooms).toBe(stats.restRooms);

      // 7. 获取历史记录并验证
      const historyResponse = await request(app)
        .get('/api/shift-handover/history')
        .query({
          startDate: today,
          endDate: today
        })
        .expect(200);

      const savedHistory = historyResponse.body.find(record =>
        record.id === testHandoverId
      );

      expect(savedHistory).toBeDefined();
      expect(savedHistory.cashier_name).toBe('集成测试收银员');
      expect(savedHistory.type).toBe('hotel');

      // 8. 测试Excel导出
      const exportResponse = await request(app)
        .post('/api/shift-handover/export')
        .send({
          type: 'hotel',
          date: today,
          details: [...hotelReceiptsResponse.body, ...restReceiptsResponse.body],
          statistics: handoverData.statistics
        })
        .expect(200);

      expect(exportResponse.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(exportResponse.body.length).toBeGreaterThan(0);

      console.log('✅ 集成测试完成 - 交接班完整流程验证通过');
      console.log(`📊 测试数据汇总:`);
      console.log(`   - 客房收入: ¥${stats.hotelIncome}`);
      console.log(`   - 休息房收入: ¥${stats.restIncome}`);
      console.log(`   - 客房数量: ${stats.totalRooms}`);
      console.log(`   - 休息房数量: ${stats.restRooms}`);
      console.log(`   - 交接班记录ID: ${testHandoverId}`);
    }, 30000); // 增加超时时间到30秒
  });

  describe('并发交接班测试', () => {
    test('应该能够处理并发保存交接班记录', async () => {
      const today = new Date().toISOString().split('T')[0];

      const handoverPromises = [];

      // 创建5个并发的交接班保存请求
      for (let i = 1; i <= 5; i++) {
        const handoverData = {
          type: i % 2 === 0 ? 'hotel' : 'rest',
          cashier_name: `并发测试收银员${i}`,
          shift_time: `${8 + i}:00`,
          shift_date: today,
          statistics: {
            reserveCash: 1000,
            hotelIncome: i * 100,
            restIncome: i * 50,
            carRentalIncome: i * 20,
            totalIncome: i * 170 + 1000,
            hotelDeposit: i * 30,
            restDeposit: i * 20,
            retainedAmount: i * 10,
            handoverAmount: i * 110 + 1000,
            goodReviews: i,
            vipCards: Math.floor(i / 2),
            totalRooms: i * 2,
            restRooms: i
          },
          details: [],
          remarks: `集成测试并发记录${i}`
        };

        handoverPromises.push(
          request(app)
            .post('/api/shift-handover/save')
            .send(handoverData)
        );
      }

      const responses = await Promise.all(handoverPromises);

      // 验证所有请求都成功
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('message', '交接班记录保存成功');
        expect(response.body).toHaveProperty('id');
      });

      // 验证所有记录都已保存到数据库
      const savedRecords = await query(
        'SELECT * FROM shift_handover WHERE remarks LIKE \'%集成测试并发记录%\' ORDER BY created_at'
      );      expect(savedRecords.rows.length).toBe(5);

      savedRecords.rows.forEach((record, index) => {
        expect(record.cashier_name).toBe(`并发测试收银员${index + 1}`);
        expect(record.remarks).toBe(`集成测试并发记录${index + 1}`);
      });
    }, 20000);
  });

  describe('数据一致性测试', () => {
    test('应该确保收款明细与统计数据的一致性', async () => {
      const today = new Date().toISOString().split('T')[0];

      // 获取客房和休息房收款明细
      const [hotelReceipts, restReceipts, statistics] = await Promise.all([
        request(app).get('/api/shift-handover/receipts').query({ date: today, type: 'hotel' }),
        request(app).get('/api/shift-handover/receipts').query({ date: today, type: 'rest' }),
        request(app).get('/api/shift-handover/statistics').query({ date: today })
      ]);

      // 计算明细数据的总和
      const hotelIncomeFromDetails = hotelReceipts.body.reduce((sum, receipt) =>
        sum + parseFloat(receipt.total_amount), 0
      );

      const restIncomeFromDetails = restReceipts.body.reduce((sum, receipt) =>
        sum + parseFloat(receipt.total_amount), 0
      );

      const hotelRoomsFromDetails = hotelReceipts.body.length;
      const restRoomsFromDetails = restReceipts.body.length;

      // 验证统计数据与明细数据的一致性
      expect(statistics.body.hotelIncome).toBe(hotelIncomeFromDetails);
      expect(statistics.body.restIncome).toBe(restIncomeFromDetails);
      expect(statistics.body.totalRooms).toBe(hotelRoomsFromDetails);
      expect(statistics.body.restRooms).toBe(restRoomsFromDetails);

      // 验证总收入计算的正确性
      const expectedTotalIncome = statistics.body.reserveCash +
                                 statistics.body.hotelIncome +
                                 statistics.body.restIncome +
                                 statistics.body.carRentalIncome;

      expect(statistics.body.totalIncome).toBe(expectedTotalIncome);

      // 验证交接款计算的正确性
      const expectedHandoverAmount = statistics.body.totalIncome -
                                   statistics.body.hotelDeposit -
                                   statistics.body.restDeposit -
                                   statistics.body.retainedAmount;

      expect(statistics.body.handoverAmount).toBe(expectedHandoverAmount);
    });
  });

  describe('错误处理测试', () => {
    test('应该正确处理无效的日期格式', async () => {
      const invalidDate = 'invalid-date';

      const response = await request(app)
        .get('/api/shift-handover/receipts')
        .query({ date: invalidDate, type: 'hotel' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('应该正确处理无效的交接班类型', async () => {
      const today = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/shift-handover/receipts')
        .query({ date: today, type: 'invalid-type' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('应该正确处理缺少必填字段的保存请求', async () => {
      const incompleteData = {
        type: 'hotel'
        // 缺少其他必填字段
      };

      const response = await request(app)
        .post('/api/shift-handover/save')
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
