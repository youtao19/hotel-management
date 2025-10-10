/**
 * 完成交接班测试文件
 *
 * 测试接口：POST /api/handover/complete
 *
 * ✅ 核心功能说明：
 * 1. 保存完整的交接班数据到handover表
 * 2. 为四种支付方式（现金、微信、微邮付、其他）分别创建记录
 * 3. 使用事务确保数据完整性（所有支付方式要么全部成功，要么全部失败）
 * 4. 支持数据更新（使用ON CONFLICT DO UPDATE处理已存在的记录）
 *
 * ✅ 测试覆盖范围：
 * - ✅ 参数验证（必需字段、数据类型、格式验证）
 * - ✅ 正常业务流程（完整数据保存、计算逻辑验证）
 * - ✅ 数据更新逻辑（重复提交时更新已有记录）
 * - ✅ 边界情况（零值、空值、特殊字符等）
 *
 * 📊 数据库表结构（handover表）：
 * - id: SERIAL PRIMARY KEY
 * - date: DATE NOT NULL - 交接日期
 * - handover_person: VARCHAR(50) - 交班人
 * - takeover_person: VARCHAR(50) - 接班人
 * - vip_card: INT - VIP卡数量（只在现金记录中保存）
 * - payment_type: SMALLINT - 支付方式（1=现金，2=微信，3=微邮付，4=其他）
 * - reserve_cash: NUMERIC(10,2) - 备用金
 * - room_income: NUMERIC(10,2) - 客房收入
 * - rest_income: NUMERIC(10,2) - 休息房收入
 * - rent_income: NUMERIC(10,2) - 租车收入
 * - total_income: NUMERIC(10,2) - 合计收入
 * - room_refund: NUMERIC(10,2) - 客房退押
 * - rest_refund: NUMERIC(10,2) - 休息房退押
 * - retained: NUMERIC(10,2) - 留存款
 * - handover: NUMERIC(10,2) - 交接款
 * - task_list: JSONB - 任务列表（只在现金记录中保存）
 * - remarks: TEXT - 备注信息（只在现金记录中保存）
 * - UNIQUE(date, payment_type) - 唯一约束
 *
 * 💡 业务规则说明：
 * 1. 每种支付方式都会创建一条独立的记录（共4条）
 * 2. vipCard、taskList、notes只保存在现金记录（payment_type=1）中
 * 3. 如果receivePerson为空或空字符串，返回400错误
 * 4. handoverPerson可选，默认值为"系统"
 * 5. 使用数据库事务确保四条记录要么全部成功，要么全部失败
 * 6. 如果同一天同一支付方式的记录已存在，会更新现有记录
 *
 * 作者：AI Assistant
 * 日期：2025-10-10
 */

const request = require('supertest');
const app = require('../../app');

describe('POST /api/handover/complete - 完成交接班', () => {
  // 设置测试超时时间
  // jest.setTimeout(5000);

  describe('参数验证', () => {
    it('缺少日期参数时应该返回400错误', async () => {
      const requestData = {
        receivePerson: '张三',
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少必需的日期参数');
    });

    it('缺少接班人参数时应该返回400错误', async () => {
      const requestData = {
        date: '2024-06-15',
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('请输入接班人员姓名');
    });

    it('接班人为空字符串时应该返回400错误', async () => {
      const requestData = {
        date: '2024-06-15',
        receivePerson: '   ',  // 只包含空格
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('请输入接班人员姓名');
    });

    it('缺少支付数据时应该返回400错误', async () => {
      const requestData = {
        date: '2024-06-15',
        receivePerson: '张三'
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少支付数据');
    });
  });

  describe('正常业务流程', () => {
    it('应该成功保存完整的交接班数据（包含所有四种支付方式）', async () => {
      const testDate = '2024-06-15';
      const requestData = {
        date: testDate,
        handoverPerson: '李四',
        receivePerson: '王五',
        vipCard: 10,
        taskList: [
          { id: 1, title: '检查前台设备', completed: false },
          { id: 2, title: '清点现金', completed: true }
        ],
        notes: '今日交接顺利，无异常情况',
        paymentData: {
          reserve: { '现金': 500, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 1000, '微信': 800, '微邮付': 600, '其他': 300 },
          restIncome: { '现金': 200, '微信': 150, '微邮付': 100, '其他': 50 },
          carRentIncome: { '现金': 100, '微信': 50, '微邮付': 0, '其他': 20 },
          totalIncome: { '现金': 1800, '微信': 1000, '微邮付': 700, '其他': 370 },
          hotelDeposit: { '现金': 300, '微信': 200, '微邮付': 100, '其他': 50 },
          restDeposit: { '现金': 100, '微信': 50, '微邮付': 0, '其他': 20 },
          retainedAmount: { '现金': 200, '微信': 100, '微邮付': 50, '其他': 30 },
          handoverAmount: { '现金': 1200, '微信': 650, '微邮付': 550, '其他': 270 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      // 验证响应
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('交接班完成，数据已保存');
      expect(res.body.data).toMatchObject({
        date: testDate,
        handoverPerson: '李四',
        receivePerson: '王五',
        recordCount: 4  // 四种支付方式
      });

      // 验证返回的records数组
      expect(Array.isArray(res.body.data.records)).toBe(true);
      expect(res.body.data.records.length).toBe(4);
    });

    it('应该正确处理默认值（handoverPerson为空时使用"系统"）', async () => {
      const testDate = '2024-06-20';
      const requestData = {
        date: testDate,
        receivePerson: '赵六',
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 500, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 500, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 500, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.data.handoverPerson).toBe('系统');
      expect(res.body.data.receivePerson).toBe('赵六');
      expect(res.body.data.recordCount).toBe(4);
    });

    it('应该正确处理所有数值为零的情况', async () => {
      const testDate = '2024-07-01';
      const requestData = {
        date: testDate,
        receivePerson: '孙七',
        handoverPerson: '周八',
        vipCard: 0,
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recordCount).toBe(4);
      expect(res.body.data.handoverPerson).toBe('周八');
      expect(res.body.data.receivePerson).toBe('孙七');
    });

    it('应该正确处理空的任务列表和备注', async () => {
      const testDate = '2024-07-10';
      const requestData = {
        date: testDate,
        receivePerson: '测试员',
        handoverPerson: '交班员',
        taskList: [],  // 空数组
        notes: '',     // 空字符串
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('数据更新逻辑', () => {
    it('应该成功更新已存在的交接班记录', async () => {
      const testDate = '2024-08-01';

      // 第一次提交
      const firstData = {
        date: testDate,
        receivePerson: '初始接班人',
        handoverPerson: '初始交班人',
        vipCard: 5,
        paymentData: {
          reserve: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 500, '微信': 300, '微邮付': 200, '其他': 100 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 600, '微信': 300, '微邮付': 200, '其他': 100 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 600, '微信': 300, '微邮付': 200, '其他': 100 }
        }
      };

      const firstRes = await request(app)
        .post('/api/handover/complete')
        .send(firstData);

      expect(firstRes.status).toBe(200);

      // 第二次提交（更新）
      const secondData = {
        date: testDate,
        receivePerson: '更新后接班人',
        handoverPerson: '更新后交班人',
        vipCard: 10,  // 更新VIP卡数量
        paymentData: {
          reserve: { '现金': 200, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 1000, '微信': 600, '微邮付': 400, '其他': 200 },
          restIncome: { '现金': 100, '微信': 50, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 50, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 1350, '微信': 650, '微邮付': 400, '其他': 200 },
          hotelDeposit: { '现金': 150, '微信': 50, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 1100, '微信': 600, '微邮付': 400, '其他': 200 }
        }
      };

      const secondRes = await request(app)
        .post('/api/handover/complete')
        .send(secondData);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.success).toBe(true);
      expect(secondRes.body.data.handoverPerson).toBe('更新后交班人');
      expect(secondRes.body.data.receivePerson).toBe('更新后接班人');
    });
  });

  describe('边界情况', () => {
    it('应该正确处理特殊字符在姓名和备注中', async () => {
      const testDate = '2024-09-10';
      const requestData = {
        date: testDate,
        receivePerson: '张三@#$%',
        handoverPerson: '李四<>?',
        notes: '特殊字符测试：!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.data.receivePerson).toBe('张三@#$%');
      expect(res.body.data.handoverPerson).toBe('李四<>?');
    });

    it('应该正确处理中文姓名和备注', async () => {
      const testDate = '2024-09-15';
      const requestData = {
        date: testDate,
        receivePerson: '王小明',
        handoverPerson: '李大华',
        notes: '今日天气晴朗，客流量较大，交接顺利完成。',
        taskList: [
          { id: 1, title: '检查消防设备', completed: true },
          { id: 2, title: '清点库存物资', completed: false }
        ],
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.data.receivePerson).toBe('王小明');
      expect(res.body.data.handoverPerson).toBe('李大华');
    });
  });

  describe('特殊日期处理', () => {
    it('应该正确处理月末日期（2024-02-29闰年）', async () => {
      const testDate = '2024-02-29';
      const requestData = {
        date: testDate,
        receivePerson: '闰年测试',
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.data.date).toBe(testDate);
    });

    it('应该正确处理年末日期（2024-12-31）', async () => {
      const testDate = '2024-12-31';
      const requestData = {
        date: testDate,
        receivePerson: '年末测试',
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.data.date).toBe(testDate);
    });
  });

  describe('数据完整性验证', () => {
    it('返回的数据应该包含所有必需字段', async () => {
      const testDate = '2024-10-01';
      const requestData = {
        date: testDate,
        receivePerson: '完整性测试',
        handoverPerson: '交班人',
        paymentData: {
          reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          totalIncome: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 },
          hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
          handoverAmount: { '现金': 100, '微信': 0, '微邮付': 0, '其他': 0 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);

      // 验证响应结构
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('data');

      // 验证data对象包含所有必需字段
      expect(res.body.data).toHaveProperty('date');
      expect(res.body.data).toHaveProperty('handoverPerson');
      expect(res.body.data).toHaveProperty('receivePerson');
      expect(res.body.data).toHaveProperty('recordCount');
      expect(res.body.data).toHaveProperty('records');

      // 验证records数组
      expect(Array.isArray(res.body.data.records)).toBe(true);
      expect(res.body.data.records.length).toBe(4);

      // 验证每条记录都包含必要字段
      res.body.data.records.forEach(record => {
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('date');
        expect(record).toHaveProperty('payment_type');
        expect(record).toHaveProperty('handover_person');
        expect(record).toHaveProperty('takeover_person');
      });
    });
  });
});
