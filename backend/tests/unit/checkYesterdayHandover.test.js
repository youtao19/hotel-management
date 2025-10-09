/**
 * 检查交接记录路由测试文件
 *
 * 测试接口：GET /api/handover/check-yesterday
 *
 * API 行为：
 * - 前端传入要查询的交接记录日期（date参数）
 * - 后端直接查询该日期的交接记录，不再做日期计算
 *
 * 测试场景：
 * 1. 成功检查指定日期有完整交接记录（4种支付方式都有）
 * 2. 指定日期有部分交接记录（支付方式不完整）
 * 3. 指定日期无交接记录
 * 4. 缺少日期参数返回400错误
 * 5. 日期格式不正确的情况
 */

const request = require('supertest');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');

describe('GET /api/handover/check-yesterday - 检查昨日交接记录', () => {
  beforeEach(async () => {
    // 清理测试数据
    if (global.cleanupTestData) {
      await global.cleanupTestData();
    }

    // 确保 handover 表被清空，避免唯一索引导致的数据残留
    await query('TRUNCATE TABLE handover RESTART IDENTITY CASCADE;');
  });

  afterEach(async () => {
    // 每个测试后清理数据
    if (global.cleanupTestData) {
      await global.cleanupTestData();
    }
  });

  describe('成功场景', () => {
    it('应该正确检查指定日期有完整交接记录（4种支付方式）', async () => {
      // 准备测试数据：在2024-01-15插入完整的交接记录
      const testDate = '2024-01-15';
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, rest_income, rent_income, total_income,
          room_refund, rest_refund, retained, handover
        ) VALUES
          ($1, '张三', '李四', 1, 500, 1000, 200, 100, 1800, 300, 100, 200, 1200),
          ($1, '张三', '李四', 2, 0, 800, 150, 50, 1000, 200, 50, 100, 650),
          ($1, '张三', '李四', 3, 0, 600, 100, 0, 700, 100, 0, 50, 550),
          ($1, '张三', '李四', 4, 0, 300, 50, 20, 370, 50, 20, 30, 270)
      `;
      await query(insertSql, [testDate]);

      // 测试：直接查询2024-01-15的交接记录
      const queryDate = testDate; // 直接使用测试日期
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('已完成交接');
      expect(res.body.data).toMatchObject({
        date: testDate,
        hasRecord: true,
        isComplete: true,
        paymentCount: 4,
        paymentTypes: [1, 2, 3, 4],
        handoverPerson: '张三',
        takeoverPerson: '李四'
      });
    });

    it('应该正确检查指定日期交接记录不完整（只有部分支付方式）', async () => {
      // 准备测试数据：在2024-01-20只插入2种支付方式
      const testDate = '2024-01-20';
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '王五', '赵六', 1, 500, 1000, 1500, 1000),
          ($1, '王五', '赵六', 2, 0, 800, 800, 800)
      `;
      await query(insertSql, [testDate]);

      // 测试：直接查询2024-01-20的交接记录
      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('交接记录不完整');
      expect(res.body.data).toMatchObject({
        date: testDate,
        hasRecord: true,
        isComplete: false,
        paymentCount: 2,
        paymentTypes: [1, 2],
        handoverPerson: '王五',
        takeoverPerson: '赵六'
      });
    });

    it('应该正确检查指定日期无交接记录', async () => {
      // 不插入任何数据，直接查询一个没有记录的日期
      const queryDate = '2024-01-25';
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('无交接记录');
      expect(res.body.data).toMatchObject({
        date: queryDate, // 返回查询的日期本身
        hasRecord: false,
        isComplete: false,
        paymentCount: 0,
        paymentTypes: [],
        handoverPerson: null,
        takeoverPerson: null
      });
    });

    it('应该正确查询月末日期的交接记录', async () => {
      // 准备测试数据：在2024-01-31插入完整记录
      const testDate = '2024-01-31';
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '陈七', '刘八', 1, 500, 1000, 1500, 1000),
          ($1, '陈七', '刘八', 2, 0, 800, 800, 800),
          ($1, '陈七', '刘八', 3, 0, 600, 600, 600),
          ($1, '陈七', '刘八', 4, 0, 300, 300, 300)
      `;
      await query(insertSql, [testDate]);

      // 测试：直接查询2024-01-31的交接记录
      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('已完成交接');
      expect(res.body.data).toMatchObject({
        date: testDate,
        hasRecord: true,
        isComplete: true,
        paymentCount: 4
      });
    });

    it('应该正确查询年末日期的交接记录', async () => {
      // 准备测试数据：在2023-12-31插入完整记录
      const testDate = '2023-12-31';
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '孙九', '周十', 1, 500, 1000, 1500, 1000),
          ($1, '孙九', '周十', 2, 0, 800, 800, 800),
          ($1, '孙九', '周十', 3, 0, 600, 600, 600),
          ($1, '孙九', '周十', 4, 0, 300, 300, 300)
      `;
      await query(insertSql, [testDate]);

      // 测试：直接查询2023-12-31的交接记录
      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('已完成交接');
      expect(res.body.data).toMatchObject({
        date: testDate,
        hasRecord: true,
        isComplete: true,
        paymentCount: 4
      });
    });
  });

  describe('参数验证', () => {
    it('缺少日期参数时应该返回400错误', async () => {
      const res = await request(app)
        .get('/api/handover/check-yesterday');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少必需的日期参数');
    });

    it('日期参数为空字符串时应该返回400错误', async () => {
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少必需的日期参数');
    });
  });

  describe('边界情况', () => {
    it('应该正确处理只有3种支付方式的情况', async () => {
      // 准备测试数据：只插入3种支付方式
      const testDate = '2024-02-15';
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '测试人1', '测试人2', 1, 500, 1000, 1500, 1000),
          ($1, '测试人1', '测试人2', 2, 0, 800, 800, 800),
          ($1, '测试人1', '测试人2', 3, 0, 600, 600, 600)
      `;
      await query(insertSql, [testDate]);

      // 测试：直接查询2024-02-15的交接记录
      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('交接记录不完整');
      expect(res.body.data.paymentCount).toBe(3);
      expect(res.body.data.isComplete).toBe(false);
    });

    it('应该正确处理只有1种支付方式的情况', async () => {
      // 准备测试数据：只插入1种支付方式
      const testDate = '2024-03-10';
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '测试人A', '测试人B', 1, 500, 1000, 1500, 1000)
      `;
      await query(insertSql, [testDate]);

      // 测试：直接查询2024-03-10的交接记录
      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('交接记录不完整');
      expect(res.body.data.paymentCount).toBe(1);
      expect(res.body.data.paymentTypes).toEqual([1]);
      expect(res.body.data.isComplete).toBe(false);
    });

    it('应该忽略非标准支付方式（payment_type不在1-4范围内）', async () => {
      // 准备测试数据：插入一些非标准的payment_type
      const testDate = '2024-04-20';
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '测试人X', '测试人Y', 1, 500, 1000, 1500, 1000),
          ($1, '测试人X', '测试人Y', 2, 0, 800, 800, 800),
          ($1, '测试人X', '测试人Y', 5, 0, 600, 600, 600),
          ($1, '测试人X', '测试人Y', 99, 0, 300, 300, 300)
      `;
      await query(insertSql, [testDate]);

      // 测试：直接查询2024-04-20，应该只计算payment_type为1-4的记录
      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentCount).toBe(2); // 只有1和2
      expect(res.body.data.paymentTypes).toEqual([1, 2]);
      expect(res.body.data.isComplete).toBe(false);
    });

    it('应该正确处理相同支付方式有多条记录的情况', async () => {
      // 准备测试数据：同一天同一支付方式有多条记录（理论上不应该发生，但测试边界情况）
      // 注意：由于表有UNIQUE(date, payment_type)约束，这种情况实际无法插入
      // 所以我们测试正常情况下的去重逻辑
      const testDate = '2024-05-10';
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '去重测试1', '去重测试2', 1, 500, 1000, 1500, 1000),
          ($1, '去重测试1', '去重测试2', 2, 0, 800, 800, 800),
          ($1, '去重测试1', '去重测试2', 3, 0, 600, 600, 600),
          ($1, '去重测试1', '去重测试2', 4, 0, 300, 300, 300)
      `;
      await query(insertSql, [testDate]);

      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentCount).toBe(4);
      expect(res.body.data.paymentTypes).toEqual([1, 2, 3, 4]);
      // 验证去重逻辑：payment_types数组长度应该等于paymentCount
      expect(res.body.data.paymentTypes.length).toBe(res.body.data.paymentCount);
    });
  });

  describe('特殊日期查询', () => {
    it('应该正确查询2月27日的交接记录（非闰年）', async () => {
      const testDate = '2023-02-27'; // 2023年非闰年
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '日期测试', '日期测试', 1, 100, 200, 300, 200),
          ($1, '日期测试', '日期测试', 2, 0, 150, 150, 150),
          ($1, '日期测试', '日期测试', 3, 0, 100, 100, 100),
          ($1, '日期测试', '日期测试', 4, 0, 50, 50, 50)
      `;
      await query(insertSql, [testDate]);

      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.data.date).toBe(testDate);
      expect(res.body.data.isComplete).toBe(true);
    });

    it('应该正确查询2月28日的交接记录（闰年）', async () => {
      const testDate = '2024-02-28'; // 2024年是闰年
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '闰年测试', '闰年测试', 1, 100, 200, 300, 200),
          ($1, '闰年测试', '闰年测试', 2, 0, 150, 150, 150),
          ($1, '闰年测试', '闰年测试', 3, 0, 100, 100, 100),
          ($1, '闰年测试', '闰年测试', 4, 0, 50, 50, 50)
      `;
      await query(insertSql, [testDate]);

      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.data.date).toBe(testDate);
      expect(res.body.data.isComplete).toBe(true);
    });

    it('应该正确查询2月29日的交接记录（闰年）', async () => {
      const testDate = '2024-02-29'; // 闰年的2月29日
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '闰年末测试', '闰年末测试', 1, 100, 200, 300, 200),
          ($1, '闰年末测试', '闰年末测试', 2, 0, 150, 150, 150),
          ($1, '闰年末测试', '闰年末测试', 3, 0, 100, 100, 100),
          ($1, '闰年末测试', '闰年末测试', 4, 0, 50, 50, 50)
      `;
      await query(insertSql, [testDate]);

      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.data.date).toBe(testDate);
      expect(res.body.data.isComplete).toBe(true);
    });
  });

  describe('数据完整性', () => {
    it('返回的数据应该包含所有必需字段', async () => {
      const testDate = '2024-06-15';
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '完整性测试1', '完整性测试2', 1, 500, 1000, 1500, 1000),
          ($1, '完整性测试1', '完整性测试2', 2, 0, 800, 800, 800),
          ($1, '完整性测试1', '完整性测试2', 3, 0, 600, 600, 600),
          ($1, '完整性测试1', '完整性测试2', 4, 0, 300, 300, 300)
      `;
      await query(insertSql, [testDate]);

      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('message');

      // 验证data对象包含所有必需字段
      expect(res.body.data).toHaveProperty('date');
      expect(res.body.data).toHaveProperty('hasRecord');
      expect(res.body.data).toHaveProperty('isComplete');
      expect(res.body.data).toHaveProperty('paymentCount');
      expect(res.body.data).toHaveProperty('paymentTypes');
      expect(res.body.data).toHaveProperty('handoverPerson');
      expect(res.body.data).toHaveProperty('takeoverPerson');
    });

    it('paymentTypes数组应该按升序排列', async () => {
      const testDate = '2024-07-20';
      // 故意不按顺序插入
      const insertSql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, payment_type,
          reserve_cash, room_income, total_income, handover
        ) VALUES
          ($1, '排序测试', '排序测试', 4, 0, 300, 300, 300),
          ($1, '排序测试', '排序测试', 1, 500, 1000, 1500, 1000),
          ($1, '排序测试', '排序测试', 3, 0, 600, 600, 600),
          ($1, '排序测试', '排序测试', 2, 0, 800, 800, 800)
      `;
      await query(insertSql, [testDate]);

      const queryDate = testDate;
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: queryDate });

      expect(res.status).toBe(200);
      expect(res.body.data.paymentTypes).toEqual([1, 2, 3, 4]);
      // 验证数组确实是升序
      const types = res.body.data.paymentTypes;
      for (let i = 1; i < types.length; i++) {
        expect(types[i]).toBeGreaterThan(types[i - 1]);
      }
    });
  });
});
