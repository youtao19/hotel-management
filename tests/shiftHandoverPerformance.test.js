const request = require('supertest');
const app = require('../app');
const { query } = require('../backend/database/postgreDB/pg');
const shiftHandoverModule = require('../backend/modules/shiftHandoverModule');

describe('交接班功能性能测试', () => {
  beforeAll(async () => {
    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'PERF_%\'');
    await query('DELETE FROM shift_handover WHERE remarks LIKE \'%性能测试%\'');
  });

  afterAll(async () => {
    // 清理测试数据
    await query('DELETE FROM orders WHERE order_id LIKE \'PERF_%\'');
    await query('DELETE FROM shift_handover WHERE remarks LIKE \'%性能测试%\'');
  });

  describe('大数据量性能测试', () => {
    test('应该能够快速处理1000条订单记录', async () => {
      console.log('开始生成1000条测试订单数据...');
      const startTime = Date.now();

      // 使用固定的测试日期，确保数据一致性
      const testDate = '2025-06-12';
      const batchSize = 100; // 批量插入以提高性能

      // 先获取可用的房间号
      const availableRooms = ['101', '104', '105', '106', '107', '108', '109', '110',
                             '201', '203', '204', '205', '206', '207', '208',
                             '301', '302', '303', '304', '305', '306'];

      // 生成1000条订单数据
      for (let batch = 0; batch < 10; batch++) {
        const batchOrders = [];

        for (let i = 0; i < batchSize; i++) {
          const orderIndex = batch * batchSize + i + 1;
          const roomTypes = ['standard', 'deluxe', 'suite'];
          const paymentMethods = ['现金', '微信', '支付宝', '银行卡'];
          const roomType = roomTypes[orderIndex % roomTypes.length];
          const roomNumber = availableRooms[orderIndex % availableRooms.length];

          // 使用固定的测试日期确保所有数据都能被查询到
          const dateStr = testDate;
          const createTimeStr = `${testDate} ${(10 + orderIndex % 12).toString().padStart(2, '0')}:${(orderIndex % 60).toString().padStart(2, '0')}:00`;

          batchOrders.push([
            `PERF_${orderIndex.toString().padStart(4, '0')}`,
            'system',
            'front_desk',
            `性能测试客人${orderIndex}`,
            `138${orderIndex.toString().padStart(8, '0')}`,
            `11010119900101${orderIndex.toString().padStart(4, '0')}`,
            roomType,
            roomNumber,
            88.00 + (orderIndex % 10) * 20, // 价格范围88-268
            50.00 + (orderIndex % 5) * 25,  // 押金范围50-150
            paymentMethods[orderIndex % paymentMethods.length],
            'checked_out',
            dateStr,
            dateStr,
            createTimeStr,
            '性能测试数据'
          ]);
        }

        // 批量插入
        const placeholders = batchOrders.map((_, index) => {
          const offset = index * 16;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16})`;
        }).join(', ');

        const sql = `
          INSERT INTO orders (
            order_id, id_source, order_source, guest_name, phone, id_number,
            room_type, room_number, room_price, deposit, payment_method,
            status, check_in_date, check_out_date, create_time, remarks
          ) VALUES ${placeholders}
        `;

        await query(sql, batchOrders.flat());
      }

      const dataGenerationTime = Date.now() - startTime;
      console.log(`数据生成完成，用时: ${dataGenerationTime}ms`);

      // 测试获取收款明细的性能
      const receiptsStartTime = Date.now();

      const hotelReceipts = await shiftHandoverModule.getReceiptDetails('hotel', testDate, testDate);
      const receiptsEndTime = Date.now();

      console.log(`获取收款明细用时: ${receiptsEndTime - receiptsStartTime}ms`);
      console.log(`客房订单数量: ${hotelReceipts.length}`);

      // 性能要求：1000条记录的查询应在1秒内完成
      expect(receiptsEndTime - receiptsStartTime).toBeLessThan(1000);
      expect(hotelReceipts.length).toBeGreaterThan(500); // Adjusted based on business logic classification

      // 测试统计计算的性能
      const statisticsStartTime = Date.now();

      const statistics = await shiftHandoverModule.getStatistics(testDate, testDate);
      const statisticsEndTime = Date.now();

      console.log(`统计计算用时: ${statisticsEndTime - statisticsStartTime}ms`);
      console.log(`总收入: ¥${statistics.totalIncome}`);

      // 性能要求：统计计算应在500ms内完成
      expect(statisticsEndTime - statisticsStartTime).toBeLessThan(500);
      expect(statistics.totalIncome).toBeGreaterThan(0);
      expect(statistics.totalRooms).toBeGreaterThan(700);
      expect(statistics.restRooms).toBeGreaterThan(200);

    }, 60000); // 60秒超时

    test('应该能够快速生成大量数据的Excel报告', async () => {
      const today = new Date().toISOString().split('T')[0];

      // 获取所有测试数据
      const hotelReceipts = await shiftHandoverModule.getReceiptDetails('hotel', today, today);
      const restReceipts = await shiftHandoverModule.getReceiptDetails('rest', today, today);
      const statistics = await shiftHandoverModule.getStatistics(today, today);

      const exportData = {
        type: 'hotel',
        date: today,
        details: [...hotelReceipts, ...restReceipts], // 合并所有明细
        statistics: statistics
      };

      const exportStartTime = Date.now();

      const buffer = await shiftHandoverModule.exportHandoverToExcel(exportData);
      const exportEndTime = Date.now();

      console.log(`Excel生成用时: ${exportEndTime - exportStartTime}ms`);
      console.log(`Excel文件大小: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`明细记录数量: ${exportData.details.length}`);

      // 性能要求：1000条记录的Excel生成应在3秒内完成
      expect(exportEndTime - exportStartTime).toBeLessThan(3000);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);

    }, 30000);
  });

  describe('并发性能测试', () => {
    test('应该能够处理并发API请求', async () => {
      const today = new Date().toISOString().split('T')[0];
      const concurrentRequests = 50;

      console.log(`开始${concurrentRequests}个并发API请求测试...`);

      const startTime = Date.now();

      // 创建并发请求数组
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const requestType = i % 4;

        switch (requestType) {
          case 0:
            requests.push(
              request(app)
                .get('/api/shift-handover/receipts')
                .query({ date: today, type: 'hotel' })
            );
            break;
          case 1:
            requests.push(
              request(app)
                .get('/api/shift-handover/receipts')
                .query({ date: today, type: 'rest' })
            );
            break;
          case 2:
            requests.push(
              request(app)
                .get('/api/shift-handover/statistics')
                .query({ date: today })
            );
            break;
          case 3:
            requests.push(
              request(app)
                .get('/api/shift-handover/history')
                .query({
                  startDate: today,
                  endDate: today
                })
            );
            break;
        }
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      console.log(`${concurrentRequests}个并发请求完成，总用时: ${endTime - startTime}ms`);
      console.log(`平均响应时间: ${(endTime - startTime) / concurrentRequests}ms`);

      // 验证所有请求都成功
      responses.forEach((response, index) => {
        expect([200, 201].includes(response.status)).toBe(true);
      });

      // 性能要求：50个并发请求应在5秒内完成
      expect(endTime - startTime).toBeLessThan(5000);

    }, 30000);

    test('应该能够处理并发交接班保存', async () => {
      const today = new Date().toISOString().split('T')[0];
      const concurrentSaves = 20;

      console.log(`开始${concurrentSaves}个并发保存测试...`);

      const startTime = Date.now();

      const savePromises = [];

      for (let i = 1; i <= concurrentSaves; i++) {
        const handoverData = {
          type: i % 2 === 0 ? 'hotel' : 'rest',
          cashier_name: `并发性能测试${i}`,
          shift_time: `${8 + (i % 12)}:${(i * 5) % 60}`,
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
            goodReviews: i % 10,
            vipCards: i % 5,
            totalRooms: i * 2,
            restRooms: i
          },
          details: [],
          remarks: `性能测试并发保存${i}`
        };

        savePromises.push(
          request(app)
            .post('/api/shift-handover/save')
            .send(handoverData)
        );
      }

      const responses = await Promise.all(savePromises);
      const endTime = Date.now();

      console.log(`${concurrentSaves}个并发保存完成，总用时: ${endTime - startTime}ms`);
      console.log(`平均保存时间: ${(endTime - startTime) / concurrentSaves}ms`);

      // 验证所有保存都成功
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('message', '交接班记录保存成功');
        expect(response.body).toHaveProperty('id');
      });

      // 验证数据库中的记录数量
      const savedCount = await query(
        'SELECT COUNT(*) FROM shift_handover WHERE remarks LIKE \'%性能测试并发保存%\''
      );

      expect(parseInt(savedCount.rows[0].count)).toBe(concurrentSaves);

      // 性能要求：20个并发保存应在3秒内完成
      expect(endTime - startTime).toBeLessThan(3000);

    }, 30000);
  });

  describe('内存使用测试', () => {
    test('应该在大数据量处理时控制内存使用', async () => {
      const today = new Date().toISOString().split('T')[0];

      // 记录初始内存使用
      const initialMemory = process.memoryUsage();
      console.log('初始内存使用:', {
        rss: `${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`
      });

      // 执行大数据量操作
      const receipts = await shiftHandoverModule.getReceiptDetails('hotel', today, today);
      const statistics = await shiftHandoverModule.getStatistics(today, today);

      const exportData = {
        type: 'hotel',
        date: today,
        details: receipts,
        statistics: statistics
      };

      const buffer = await shiftHandoverModule.exportHandoverToExcel(exportData);

      // 记录处理后的内存使用
      const afterMemory = process.memoryUsage();
      console.log('处理后内存使用:', {
        rss: `${(afterMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(afterMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(afterMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`
      });

      const memoryIncrease = afterMemory.heapUsed - initialMemory.heapUsed;
      console.log(`内存增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

      // 性能要求：内存增长应控制在100MB以内
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
        const afterGC = process.memoryUsage();
        console.log('GC后内存使用:', {
          rss: `${(afterGC.rss / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(afterGC.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(afterGC.heapTotal / 1024 / 1024).toFixed(2)} MB`
        });
      }

    }, 30000);
  });

  describe('响应时间基准测试', () => {
    test('API响应时间基准测试', async () => {
      const today = new Date().toISOString().split('T')[0];
      const iterations = 10;

      const benchmarks = {
        receipts_hotel: [],
        receipts_rest: [],
        statistics: [],
        history: []
      };

      console.log(`开始API响应时间基准测试 (${iterations}次迭代)...`);

      for (let i = 0; i < iterations; i++) {
        // 测试客房收款明细API
        let start = Date.now();
        await request(app)
          .get('/api/shift-handover/receipts')
          .query({ date: today, type: 'hotel' });
        benchmarks.receipts_hotel.push(Date.now() - start);

        // 测试休息房收款明细API
        start = Date.now();
        await request(app)
          .get('/api/shift-handover/receipts')
          .query({ date: today, type: 'rest' });
        benchmarks.receipts_rest.push(Date.now() - start);

        // 测试统计API
        start = Date.now();
        await request(app)
          .get('/api/shift-handover/statistics')
          .query({ date: today });
        benchmarks.statistics.push(Date.now() - start);

        // 测试历史记录API
        start = Date.now();
        await request(app)
          .get('/api/shift-handover/history')
          .query({ startDate: today, endDate: today });
        benchmarks.history.push(Date.now() - start);
      }

      // 计算统计信息
      const calculateStats = (times) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        return { avg: avg.toFixed(2), min, max };
      };

      console.log('API响应时间基准测试结果:');
      console.log('客房收款明细:', calculateStats(benchmarks.receipts_hotel), 'ms');
      console.log('休息房收款明细:', calculateStats(benchmarks.receipts_rest), 'ms');
      console.log('统计数据:', calculateStats(benchmarks.statistics), 'ms');
      console.log('历史记录:', calculateStats(benchmarks.history), 'ms');

      // 性能要求验证
      Object.values(benchmarks).forEach(times => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        expect(avg).toBeLessThan(500); // 平均响应时间应小于500ms

        times.forEach(time => {
          expect(time).toBeLessThan(2000); // 单次响应时间应小于2秒
        });
      });

    }, 60000);
  });
});
