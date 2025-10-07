/**
 * 交接班完成接口测试
 *
 * 测试 POST /api/handover/complete 接口
 *
 * 测试覆盖：
 * 1. 成功保存交接班数据（插入4条记录）
 * 2. 验证必需字段（date, receivePerson, paymentData）
 * 3. 测试更新已存在的记录（ON CONFLICT DO UPDATE）
 * 4. 验证数据库中的数据完整性
 * 5. 测试边界条件和错误处理
 */

const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');

describe('POST /api/handover/complete - 完成交接班接口测试', () => {

  // 设置测试超时时间为30秒
  jest.setTimeout(30000);

  // 在每个测试之前清理测试数据
  beforeEach(async () => {
    if (global.cleanupTestData) {
      await global.cleanupTestData();
    }
  });

  // 测试数据：标准的交接班请求数据
  const createValidRequestData = (date = '2024-01-15') => ({
    date,
    handoverPerson: '张三',
    receivePerson: '李四',
    vipCard: 5,
    taskList: [
      { id: 1, title: '检查库存', completed: false },
      { id: 2, title: '清点现金', completed: true }
    ],
    notes: '今日交接顺利，无异常情况',
    paymentData: {
      reserve: { '现金': 320, '微信': 0, '微邮付': 0, '其他': 0 },
      hotelIncome: { '现金': 1200, '微信': 2500, '微邮付': 800, '其他': 300 },
      restIncome: { '现金': 400, '微信': 600, '微邮付': 200, '其他': 0 },
      carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
      totalIncome: { '现金': 1920, '微信': 3100, '微邮付': 1000, '其他': 300 },
      hotelDeposit: { '现金': 500, '微信': 800, '微邮付': 200, '其他': 0 },
      restDeposit: { '现金': 200, '微信': 300, '微邮付': 100, '其他': 0 },
      retainedAmount: { '现金': 320, '微信': 0, '微邮付': 0, '其他': 0 },
      handoverAmount: { '现金': 900, '微信': 2000, '微邮付': 700, '其他': 300 }
    }
  });

  describe('成功场景测试', () => {
    it('应该成功保存完整的交接班数据', async () => {
      const requestData = createValidRequestData();

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      // 验证响应
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('交接班完成，数据已保存');
      expect(res.body.data).toHaveProperty('date', requestData.date);
      expect(res.body.data).toHaveProperty('handoverPerson', requestData.handoverPerson);
      expect(res.body.data).toHaveProperty('receivePerson', requestData.receivePerson);
      expect(res.body.data).toHaveProperty('recordCount', 4);
      expect(res.body.data.records).toHaveLength(4);

      // 验证数据库中实际保存了4条记录
      const dbResult = await query(
        'SELECT * FROM handover WHERE date = $1 ORDER BY payment_type',
        [requestData.date]
      );

      expect(dbResult.rows).toHaveLength(4);

      // 验证每种支付方式都有记录
      const paymentTypes = dbResult.rows.map(row => row.payment_type);
      expect(paymentTypes).toEqual([1, 2, 3, 4]); // 现金, 微信, 微邮付, 其他
    });

    it('应该正确保存现金支付方式的详细数据', async () => {
      const requestData = createValidRequestData();

      await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      // 查询现金（payment_type = 1）的记录
      const cashRecord = await query(
        'SELECT * FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );

      expect(cashRecord.rows).toHaveLength(1);
      const record = cashRecord.rows[0];

      // 验证人员信息
      expect(record.handover_person).toBe(requestData.handoverPerson);
      expect(record.takeover_person).toBe(requestData.receivePerson);

      // 验证VIP卡数量（只在现金记录中保存）
      expect(Number(record.vip_card)).toBe(requestData.vipCard);

      // 验证金额数据
      expect(Number(record.reserve_cash)).toBe(requestData.paymentData.reserve['现金']);
      expect(Number(record.room_income)).toBe(requestData.paymentData.hotelIncome['现金']);
      expect(Number(record.rest_income)).toBe(requestData.paymentData.restIncome['现金']);
      expect(Number(record.rent_income)).toBe(requestData.paymentData.carRentIncome['现金']);
      expect(Number(record.total_income)).toBe(requestData.paymentData.totalIncome['现金']);
      expect(Number(record.room_refund)).toBe(requestData.paymentData.hotelDeposit['现金']);
      expect(Number(record.rest_refund)).toBe(requestData.paymentData.restDeposit['现金']);
      expect(Number(record.retained)).toBe(requestData.paymentData.retainedAmount['现金']);
      expect(Number(record.handover)).toBe(requestData.paymentData.handoverAmount['现金']);

      // 验证任务清单和备注（只在现金记录中保存）
      expect(record.task_list).toEqual(requestData.taskList);
      expect(record.remarks).toBe(requestData.notes);
    });

    it('应该正确保存微信支付方式的数据', async () => {
      const requestData = createValidRequestData();

      await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      // 查询微信（payment_type = 2）的记录
      const wechatRecord = await query(
        'SELECT * FROM handover WHERE date = $1 AND payment_type = 2',
        [requestData.date]
      );

      expect(wechatRecord.rows).toHaveLength(1);
      const record = wechatRecord.rows[0];

      // 验证人员信息
      expect(record.handover_person).toBe(requestData.handoverPerson);
      expect(record.takeover_person).toBe(requestData.receivePerson);

      // 验证金额数据
      expect(Number(record.reserve_cash)).toBe(requestData.paymentData.reserve['微信']);
      expect(Number(record.room_income)).toBe(requestData.paymentData.hotelIncome['微信']);
      expect(Number(record.rest_income)).toBe(requestData.paymentData.restIncome['微信']);
      expect(Number(record.handover)).toBe(requestData.paymentData.handoverAmount['微信']);

      // 验证非现金支付方式不保存VIP卡、任务清单和备注
      expect(Number(record.vip_card)).toBe(0);
      expect(record.task_list).toEqual([]);
      expect(record.remarks).toBe('');
    });

    it('应该正确处理没有handoverPerson的情况（使用默认值"系统"）', async () => {
      const requestData = createValidRequestData();
      delete requestData.handoverPerson; // 不提供交班人

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.handoverPerson).toBe('系统');

      // 验证数据库
      const dbResult = await query(
        'SELECT handover_person FROM handover WHERE date = $1 LIMIT 1',
        [requestData.date]
      );
      expect(dbResult.rows[0].handover_person).toBe('系统');
    });

    it('应该正确处理空的taskList和notes', async () => {
      const requestData = createValidRequestData();
      requestData.taskList = [];
      requestData.notes = '';

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 验证数据库中现金记录的task_list和remarks
      const cashRecord = await query(
        'SELECT task_list, remarks FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );
      expect(cashRecord.rows[0].task_list).toEqual([]);
      expect(cashRecord.rows[0].remarks).toBe('');
    });

    it('应该正确处理receivePerson前后的空格', async () => {
      const requestData = createValidRequestData();
      requestData.receivePerson = '  李四  ';

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.data.receivePerson).toBe('李四'); // 应该trim掉空格
    });
  });

  describe('更新已存在记录的测试', () => {
    it('应该成功更新已存在的交接班记录', async () => {
      const requestData = createValidRequestData();

      // 第一次保存
      await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      // 修改数据后再次保存
      const updatedData = {
        ...requestData,
        handoverPerson: '王五',
        receivePerson: '赵六',
        vipCard: 8,
        notes: '已更新的备注',
        paymentData: {
          ...requestData.paymentData,
          hotelIncome: { '现金': 1500, '微信': 3000, '微邮付': 900, '其他': 400 }
        }
      };

      const res = await request(app)
        .post('/api/handover/complete')
        .send(updatedData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 验证数据库中仍然只有4条记录（没有重复）
      const dbResult = await query(
        'SELECT * FROM handover WHERE date = $1',
        [requestData.date]
      );
      expect(dbResult.rows).toHaveLength(4);

      // 验证数据已更新
      const cashRecord = await query(
        'SELECT * FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );
      expect(cashRecord.rows[0].handover_person).toBe('王五');
      expect(cashRecord.rows[0].takeover_person).toBe('赵六');
      expect(Number(cashRecord.rows[0].vip_card)).toBe(8);
      expect(cashRecord.rows[0].remarks).toBe('已更新的备注');
      expect(Number(cashRecord.rows[0].room_income)).toBe(1500);
    });

    it('多次更新同一天的记录应该保持一致性', async () => {
      const date = '2024-01-20';

      // 第一次保存
      const data1 = createValidRequestData(date);
      await request(app).post('/api/handover/complete').send(data1);

      // 第二次更新
      const data2 = { ...data1, receivePerson: '更新1' };
      await request(app).post('/api/handover/complete').send(data2);

      // 第三次更新
      const data3 = { ...data1, receivePerson: '更新2' };
      await request(app).post('/api/handover/complete').send(data3);

      // 验证只有4条记录
      const dbResult = await query(
        'SELECT COUNT(*) as count FROM handover WHERE date = $1',
        [date]
      );
      expect(Number(dbResult.rows[0].count)).toBe(4);

      // 验证最后的更新生效了
      const cashRecord = await query(
        'SELECT takeover_person FROM handover WHERE date = $1 AND payment_type = 1',
        [date]
      );
      expect(cashRecord.rows[0].takeover_person).toBe('更新2');
    });
  });

  describe('参数验证测试', () => {
    it('缺少date参数时应该返回400', async () => {
      const requestData = createValidRequestData();
      delete requestData.date;

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少必需的日期参数');
    });

    it('缺少receivePerson参数时应该返回400', async () => {
      const requestData = createValidRequestData();
      delete requestData.receivePerson;

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('请输入接班人员姓名');
    });

    it('receivePerson为空字符串时应该返回400', async () => {
      const requestData = createValidRequestData();
      requestData.receivePerson = '';

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('请输入接班人员姓名');
    });

    it('receivePerson仅包含空格时应该返回400', async () => {
      const requestData = createValidRequestData();
      requestData.receivePerson = '   ';

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('请输入接班人员姓名');
    });

    it('缺少paymentData参数时应该返回400', async () => {
      const requestData = createValidRequestData();
      delete requestData.paymentData;

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少支付数据');
    });

    it('请求体完全为空时应该返回400', async () => {
      const res = await request(app)
        .post('/api/handover/complete')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('边界条件测试', () => {
    it('应该正确处理所有金额为0的情况', async () => {
      const requestData = createValidRequestData();

      // 将所有金额设为0
      Object.keys(requestData.paymentData).forEach(key => {
        requestData.paymentData[key] = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 };
      });

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 验证数据库
      const dbResult = await query(
        'SELECT * FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );

      expect(Number(dbResult.rows[0].reserve_cash)).toBe(0);
      expect(Number(dbResult.rows[0].room_income)).toBe(0);
      expect(Number(dbResult.rows[0].handover)).toBe(0);
    });

    it('应该正确处理VIP卡数量为0的情况', async () => {
      const requestData = createValidRequestData();
      requestData.vipCard = 0;

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cashRecord = await query(
        'SELECT vip_card FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );
      expect(Number(cashRecord.rows[0].vip_card)).toBe(0);
    });

    it('应该正确处理没有提供vipCard的情况', async () => {
      const requestData = createValidRequestData();
      delete requestData.vipCard;

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cashRecord = await query(
        'SELECT vip_card FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );
      expect(Number(cashRecord.rows[0].vip_card)).toBe(0);
    });

    it('应该正确处理paymentData中缺少某些字段的情况', async () => {
      const requestData = createValidRequestData();

      // 删除一些可选字段
      delete requestData.paymentData.carRentIncome;

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 缺失的字段应该默认为0
      const cashRecord = await query(
        'SELECT rent_income FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );
      expect(Number(cashRecord.rows[0].rent_income)).toBe(0);
    });

    it('应该正确处理taskList包含复杂对象的情况', async () => {
      const requestData = createValidRequestData();
      requestData.taskList = [
        {
          id: 1,
          title: '复杂任务',
          completed: true,
          priority: 'high',
          assignee: '张三',
          dueDate: '2024-01-16'
        },
        {
          id: 2,
          title: '简单任务',
          completed: false
        }
      ];

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cashRecord = await query(
        'SELECT task_list FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );
      expect(cashRecord.rows[0].task_list).toEqual(requestData.taskList);
    });

    it('应该正确处理很长的notes文本', async () => {
      const requestData = createValidRequestData();
      requestData.notes = '这是一个很长的备注。'.repeat(100); // 1000+字符

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cashRecord = await query(
        'SELECT remarks FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );
      expect(cashRecord.rows[0].remarks).toBe(requestData.notes);
    });
  });

  describe('数据完整性测试', () => {
    it('同一天保存多次交接班数据，应该保持UNIQUE约束', async () => {
      const requestData = createValidRequestData();

      // 保存第一次
      await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      // 保存第二次（应该更新而不是插入新记录）
      await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      // 验证数据库中只有4条记录
      const dbResult = await query(
        'SELECT COUNT(*) as count FROM handover WHERE date = $1',
        [requestData.date]
      );

      expect(Number(dbResult.rows[0].count)).toBe(4);
    });

    it('不同日期的交接班数据应该独立保存', async () => {
      const date1 = '2024-01-15';
      const date2 = '2024-01-16';

      await request(app)
        .post('/api/handover/complete')
        .send(createValidRequestData(date1));

      await request(app)
        .post('/api/handover/complete')
        .send(createValidRequestData(date2));

      // 验证两个日期的数据都存在
      const result1 = await query(
        'SELECT COUNT(*) as count FROM handover WHERE date = $1',
        [date1]
      );
      const result2 = await query(
        'SELECT COUNT(*) as count FROM handover WHERE date = $1',
        [date2]
      );

      expect(Number(result1.rows[0].count)).toBe(4);
      expect(Number(result2.rows[0].count)).toBe(4);
    });

    it('所有4种支付方式的记录应该有相同的人员信息', async () => {
      const requestData = createValidRequestData();

      await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      const dbResult = await query(
        'SELECT handover_person, takeover_person FROM handover WHERE date = $1',
        [requestData.date]
      );

      // 验证所有4条记录的人员信息都一致
      expect(dbResult.rows).toHaveLength(4);
      dbResult.rows.forEach(row => {
        expect(row.handover_person).toBe(requestData.handoverPerson);
        expect(row.takeover_person).toBe(requestData.receivePerson);
      });
    });

    it('验证所有支付方式的金额数据都正确保存', async () => {
      const requestData = createValidRequestData();

      await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      const paymentTypes = [
        { code: 1, name: '现金' },
        { code: 2, name: '微信' },
        { code: 3, name: '微邮付' },
        { code: 4, name: '其他' }
      ];

      for (const paymentType of paymentTypes) {
        const record = await query(
          'SELECT * FROM handover WHERE date = $1 AND payment_type = $2',
          [requestData.date, paymentType.code]
        );

        expect(record.rows).toHaveLength(1);
        const row = record.rows[0];

        expect(Number(row.reserve_cash)).toBe(requestData.paymentData.reserve[paymentType.name]);
        expect(Number(row.room_income)).toBe(requestData.paymentData.hotelIncome[paymentType.name]);
        expect(Number(row.rest_income)).toBe(requestData.paymentData.restIncome[paymentType.name]);
        expect(Number(row.rent_income)).toBe(requestData.paymentData.carRentIncome[paymentType.name]);
        expect(Number(row.total_income)).toBe(requestData.paymentData.totalIncome[paymentType.name]);
        expect(Number(row.room_refund)).toBe(requestData.paymentData.hotelDeposit[paymentType.name]);
        expect(Number(row.rest_refund)).toBe(requestData.paymentData.restDeposit[paymentType.name]);
        expect(Number(row.retained)).toBe(requestData.paymentData.retainedAmount[paymentType.name]);
        expect(Number(row.handover)).toBe(requestData.paymentData.handoverAmount[paymentType.name]);
      }
    });
  });

  describe('特殊字符和国际化测试', () => {
    it('应该正确处理中文字符', async () => {
      const requestData = createValidRequestData();
      requestData.handoverPerson = '张三丰';
      requestData.receivePerson = '李时珍';
      requestData.notes = '今天天气很好，交接顺利。';

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('应该正确处理特殊字符', async () => {
      const requestData = createValidRequestData();
      requestData.receivePerson = "O'Brien";
      requestData.notes = '测试特殊字符: @#$%^&*()_+-=[]{}|;:\'",.<>?/~`';

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cashRecord = await query(
        'SELECT takeover_person, remarks FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );
      expect(cashRecord.rows[0].takeover_person).toBe("O'Brien");
      expect(cashRecord.rows[0].remarks).toBe(requestData.notes);
    });

    it('应该正确处理emoji字符', async () => {
      const requestData = createValidRequestData();
      requestData.notes = '今天交接很顺利 👍 😊 🎉';

      const res = await request(app)
        .post('/api/handover/complete')
        .send(requestData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cashRecord = await query(
        'SELECT remarks FROM handover WHERE date = $1 AND payment_type = 1',
        [requestData.date]
      );
      expect(cashRecord.rows[0].remarks).toBe(requestData.notes);
    });
  });
});

