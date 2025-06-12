const shiftHandoverModule = require('../backend/modules/shiftHandoverModule');
const { query } = require('../backend/database/postgreDB/pg');

describe('交接班模块单元测试', () => {
  beforeAll(async () => {
    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'MODULE_TEST_%\'');
    await query('DELETE FROM shift_handover WHERE remarks LIKE \'%模块测试%\'');

    // 插入必要的房间类型数据
    await query(`
      INSERT INTO room_types (type_code, type_name, base_price)
      VALUES
        ('standard', '标准间', 288),
        ('deluxe', '豪华间', 388),
        ('suite', '套房', 588),
        ('rest', '休息房', 88)
      ON CONFLICT (type_code) DO NOTHING
    `);

    // 插入必要的房间数据
    await query(`
      INSERT INTO rooms (room_id, room_number, type_code, status, price)
      VALUES
        (101, '101', 'standard', 'available', 288.00),
        (201, '201', 'rest', 'available', 88.00)
      ON CONFLICT (room_number) DO NOTHING
    `);
  });

  afterAll(async () => {
    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'MODULE_TEST_%\'');
    await query('DELETE FROM shift_handover WHERE remarks LIKE \'%模块测试%\'');
  });

  describe('getReceiptDetails', () => {
    beforeEach(async () => {
      // 插入测试数据
      const today = new Date().toISOString().split('T')[0];

      const testOrders = [
        {
          order_id: 'MODULE_TEST_001',
          id_source: 'system',
          order_source: 'front_desk',
          guest_name: '模块测试客人1',
          phone: '13900000001',
          id_number: '110101199001011001',
          room_type: 'standard',
          room_number: '101',
          room_price: 300.00,
          deposit: 200.00,
          payment_method: '现金',
          status: 'checked_out',
          check_in_date: today,
          check_out_date: today,
          create_time: `${today} 14:30:00`,
          remarks: '模块测试数据'
        },
        {
          order_id: 'MODULE_TEST_002',
          id_source: 'system',
          order_source: 'online',
          guest_name: '模块测试客人2',
          phone: '13900000002',
          id_number: '110101199002022002',
          room_type: 'rest',
          room_number: '201',
          room_price: 88.00,
          deposit: 50.00,
          payment_method: '微信',
          status: 'checked_out',
          check_in_date: today,
          check_out_date: today,
          create_time: `${today} 16:15:00`,
          remarks: '模块测试数据'
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
      await query('DELETE FROM orders WHERE order_id LIKE \'MODULE_TEST_%\'');
    });    test('应该正确获取客房收款明细', async () => {
      const today = new Date().toISOString().split('T')[0];

      const receipts = await shiftHandoverModule.getReceiptDetails('hotel', today, today);

      expect(Array.isArray(receipts)).toBe(true);

      const testReceipt = receipts.find(r => r.order_number === 'MODULE_TEST_001');
      expect(testReceipt).toBeDefined();
      expect(testReceipt.room_number).toBe('101');
      expect(parseFloat(testReceipt.room_fee)).toBe(300.00);
      expect(parseFloat(testReceipt.deposit)).toBe(200.00);
      expect(testReceipt.payment_method).toBe('现金');
      expect(parseFloat(testReceipt.total_amount)).toBe(500.00);
    });

    test('应该正确获取休息房收款明细', async () => {
      const today = new Date().toISOString().split('T')[0];

      const receipts = await shiftHandoverModule.getReceiptDetails('rest', today, today);

      expect(Array.isArray(receipts)).toBe(true);

      const testReceipt = receipts.find(r => r.order_number === 'MODULE_TEST_002');
      expect(testReceipt).toBeDefined();
      expect(testReceipt.room_number).toBe('201');
      expect(parseFloat(testReceipt.room_fee)).toBe(88.00);
      expect(parseFloat(testReceipt.deposit)).toBe(50.00);
      expect(testReceipt.payment_method).toBe('微信');
      expect(parseFloat(testReceipt.total_amount)).toBe(138.00);
    });

    test('应该返回空数组当没有数据时', async () => {
      const futureDate = '2025-12-31';

      const receipts = await shiftHandoverModule.getReceiptDetails('hotel', futureDate, futureDate);

      expect(Array.isArray(receipts)).toBe(true);
      expect(receipts.length).toBe(0);
    });
  });  describe('getStatistics', () => {
    test('应该正确计算统计数据', async () => {
      const today = new Date().toISOString().split('T')[0];

      const statistics = await shiftHandoverModule.getStatistics(today, today);

      expect(statistics).toHaveProperty('reserveCash');
      expect(statistics).toHaveProperty('hotelIncome');
      expect(statistics).toHaveProperty('restIncome');
      expect(statistics).toHaveProperty('carRentalIncome');
      expect(statistics).toHaveProperty('totalIncome');
      expect(statistics).toHaveProperty('hotelDeposit');
      expect(statistics).toHaveProperty('restDeposit');
      expect(statistics).toHaveProperty('retainedAmount');
      expect(statistics).toHaveProperty('handoverAmount');
      expect(statistics).toHaveProperty('goodReviews');
      expect(statistics).toHaveProperty('vipCards');
      expect(statistics).toHaveProperty('totalRooms');
      expect(statistics).toHaveProperty('restRooms');

      // 验证数据类型
      expect(typeof statistics.reserveCash).toBe('number');
      expect(typeof statistics.hotelIncome).toBe('number');
      expect(typeof statistics.restIncome).toBe('number');
      expect(typeof statistics.totalIncome).toBe('number');
      expect(typeof statistics.totalRooms).toBe('number');
      expect(typeof statistics.restRooms).toBe('number');

      // 验证计算逻辑
      const expectedTotal = statistics.reserveCash + statistics.hotelIncome +
                           statistics.restIncome + statistics.carRentalIncome;
      expect(statistics.totalIncome).toBe(expectedTotal);

      const expectedHandover = statistics.totalIncome - statistics.hotelDeposit -
                              statistics.restDeposit - statistics.retainedAmount;
      expect(statistics.handoverAmount).toBe(expectedHandover);
    });
  });

  describe('saveHandover', () => {
    test('应该正确保存交接班记录', async () => {
      const testData = {
        type: 'hotel',
        cashier_name: '模块测试收银员',
        shift_time: '08:00',
        shift_date: new Date().toISOString().split('T')[0],
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
            order_number: 'MODULE_TEST_001',
            room_number: '101',
            amount: 500
          }
        ],
        remarks: '模块测试交接班记录'
      };

      const result = await shiftHandoverModule.saveHandover(testData);

      expect(result).toHaveProperty('id');
      expect(typeof result.id).toBe('number');

      // 验证数据是否正确保存
      const savedRecord = await query(
        'SELECT * FROM shift_handover WHERE id = $1',
        [result.id]
      );

      expect(savedRecord.length).toBe(1);
      expect(savedRecord[0].cashier_name).toBe('模块测试收银员');
      expect(savedRecord[0].type).toBe('hotel');
      expect(savedRecord[0].shift_time).toBe('08:00');
      expect(savedRecord[0].remarks).toBe('模块测试交接班记录');

      const savedStatistics = typeof savedRecord[0].statistics === 'string'
        ? JSON.parse(savedRecord[0].statistics)
        : savedRecord[0].statistics;

      expect(savedStatistics.reserveCash).toBe(1000);
      expect(savedStatistics.hotelIncome).toBe(500);
      expect(savedStatistics.totalIncome).toBe(1550);
    });

    test('应该拒绝无效的数据', async () => {
      const invalidData = {
        // 缺少必填字段
        type: 'hotel'
      };

      await expect(shiftHandoverModule.saveHandover(invalidData))
        .rejects
        .toThrow();
    });
  });

  describe('getHandoverHistory', () => {
    beforeEach(async () => {
      // 插入测试历史记录
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const testRecords = [
        {
          type: 'hotel',
          cashier_name: '模块测试历史收银员1',
          shift_time: '08:00',
          shift_date: yesterday,
          statistics: { reserveCash: 800, hotelIncome: 600, totalIncome: 1400 },
          details: [],
          remarks: '模块测试历史记录1'
        },
        {
          type: 'rest',
          cashier_name: '模块测试历史收银员2',
          shift_time: '16:00',
          shift_date: twoDaysAgo,
          statistics: { reserveCash: 500, restIncome: 300, totalIncome: 800 },
          details: [],
          remarks: '模块测试历史记录2'
        }
      ];

      for (const record of testRecords) {
        await query(`
          INSERT INTO shift_handover (
            type, cashier_name, shift_time, shift_date,
            statistics, details, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          record.type, record.cashier_name, record.shift_time,
          record.shift_date, JSON.stringify(record.statistics),
          JSON.stringify(record.details), record.remarks
        ]);
      }
    });

    test('应该正确获取历史记录', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const history = await shiftHandoverModule.getHandoverHistory(startDate, endDate);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(2);

      const record1 = history.find(r => r.cashier_name === '模块测试历史收银员1');
      const record2 = history.find(r => r.cashier_name === '模块测试历史收银员2');

      expect(record1).toBeDefined();
      expect(record1.type).toBe('hotel');
      expect(record1.shift_time).toBe('08:00');

      expect(record2).toBeDefined();
      expect(record2.type).toBe('rest');
      expect(record2.shift_time).toBe('16:00');
    });

    test('应该返回空数组当日期范围内没有记录时', async () => {
      const futureStart = '2025-12-01';
      const futureEnd = '2025-12-31';

      const history = await shiftHandoverModule.getHandoverHistory(futureStart, futureEnd);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });
  });

  describe('exportHandoverToExcel', () => {
    test('应该正确生成Excel缓冲区', async () => {
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
            total_amount: 488,
            check_in_date: '2025-06-12 14:30:00',
            check_out_date: '2025-06-12 18:00:00'
          }
        ],
        statistics: {
          reserveCash: 1000,
          hotelIncome: 488,
          restIncome: 0,
          carRentalIncome: 50,
          totalIncome: 1538,
          hotelDeposit: 100,
          restDeposit: 0,
          retainedAmount: 50,
          handoverAmount: 1388,
          goodReviews: 3,
          vipCards: 1,
          totalRooms: 1,
          restRooms: 0
        }
      };

      const buffer = await shiftHandoverModule.exportHandoverToExcel(testData);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);

      // 检查Excel文件头（XLSX文件的魔数）
      const header = buffer.slice(0, 4);
      expect(header.toString('hex')).toBe('504b0304'); // PK.. (ZIP header for XLSX)
    });

    test('应该处理空数据', async () => {
      const emptyData = {
        type: 'hotel',
        date: new Date().toISOString().split('T')[0],
        details: [],
        statistics: {
          reserveCash: 0,
          hotelIncome: 0,
          restIncome: 0,
          carRentalIncome: 0,
          totalIncome: 0,
          hotelDeposit: 0,
          restDeposit: 0,
          retainedAmount: 0,
          handoverAmount: 0,
          goodReviews: 0,
          vipCards: 0,
          totalRooms: 0,
          restRooms: 0
        }
      };

      const buffer = await shiftHandoverModule.exportHandoverToExcel(emptyData);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
