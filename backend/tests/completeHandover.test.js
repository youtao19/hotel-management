/**
 * 交接完成路由测试
 *
 * 接口：POST /api/handover/complete
 *
 * 测试覆盖：
 * 1. 成功完成交接，写入四条支付方式记录
 * 2. 缺少日期参数返回 400
 * 3. 缺少接班人返回 400
 * 4. 缺少支付数据返回 400
 * 5. 再次提交同日期数据会触发更新（UPSERT）
 */

const request = require('supertest');
const app = require('../app');

const PAYMENT_METHODS = ['现金', '微信', '微邮付', '其他'];

let uniqueDateCounter = 0;
const getUniqueTestDate = () => {
  const baseDate = new Date(Date.UTC(2024, 7, 1 + uniqueDateCounter));
  uniqueDateCounter += 1;
  return baseDate.toISOString().split('T')[0];
};

const buildPaymentData = (baseValue = 100) => {
  const buildFor = (multiplier = 1) =>
    PAYMENT_METHODS.reduce((acc, method, index) => {
      acc[method] = baseValue * (index + multiplier);
      return acc;
    }, {});

  return {
    reserve: buildFor(),
    hotelIncome: buildFor(2),
    restIncome: buildFor(3),
    carRentIncome: buildFor(4),
    totalIncome: buildFor(5),
    hotelDeposit: buildFor(6),
    restDeposit: buildFor(7),
    retainedAmount: buildFor(8),
    handoverAmount: buildFor(9)
  };
};

const createBasePayload = () => ({
  date: getUniqueTestDate(),
  handoverPerson: '张三',
  receivePerson: '李四',
  paymentData: buildPaymentData(),
  vipCard: 12,
  taskList: ['检查备用金', '核对账目'],
  notes: '交接顺利完成'
});

describe('POST /api/handover/complete', () => {
  beforeAll(async () => {
    if (global.cleanupTestData) {
      await global.cleanupTestData();
    }
  });

  afterAll(async () => {
    if (global.cleanupTestData) {
      await global.cleanupTestData();
    }
  });

  it('应该成功保存四条交接记录并返回保存结果', async () => {
    const basePayload = createBasePayload();
    const res = await request(app)
      .post('/api/handover/complete')
      .send(basePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('交接班完成，数据已保存');
    expect(res.body.data).toMatchObject({
      date: basePayload.date,
      handoverPerson: basePayload.handoverPerson,
      receivePerson: basePayload.receivePerson,
      recordCount: 4
    });
    expect(Array.isArray(res.body.data.records)).toBe(true);
    expect(res.body.data.records).toHaveLength(4);

    const paymentTypes = res.body.data.records
      .map(record => record.payment_type)
      .sort((a, b) => a - b);
    expect(paymentTypes).toEqual([1, 2, 3, 4]);

    const cashRecord = res.body.data.records.find(record => record.payment_type === 1);
    expect(cashRecord).toBeDefined();
    expect(Number(cashRecord.vip_card)).toBe(basePayload.vipCard);
    expect(cashRecord.task_list).toEqual(basePayload.taskList);
    expect(cashRecord.remarks).toBe(basePayload.notes);
    expect(cashRecord.handover_person).toBe(basePayload.handoverPerson || '系统');
    expect(cashRecord.takeover_person).toBe(basePayload.receivePerson.trim());
  });

  it('缺少日期参数时应该返回400', async () => {
    const { date, ...payloadWithoutDate } = createBasePayload();

    const res = await request(app)
      .post('/api/handover/complete')
      .send(payloadWithoutDate);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('缺少必需的日期参数');
  });

  it('缺少接班人时应该返回400', async () => {
    const basePayload = createBasePayload();
    const res = await request(app)
      .post('/api/handover/complete')
      .send({
        ...basePayload,
        receivePerson: '   '
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('请输入接班人员姓名');
  });

  it('缺少支付数据时应该返回400', async () => {
    const basePayload = createBasePayload();
    const res = await request(app)
      .post('/api/handover/complete')
      .send({
        ...basePayload,
        paymentData: undefined
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('缺少支付数据');
  });

  it('再次提交同一天的数据应该执行更新而不是新增', async () => {
    const basePayload = createBasePayload();
    // 第一次提交
    const firstRes = await request(app)
      .post('/api/handover/complete')
      .send(basePayload)
      .expect(200);

    const initialIds = firstRes.body.data.records
      .map(record => record.id)
      .sort((a, b) => a - b);

    // 第二次提交，变更接班人、vip卡、备注
    const updatedPayload = {
      ...basePayload,
      receivePerson: '王五',
      vipCard: 20,
      notes: '更新后的备注'
    };

    const secondRes = await request(app)
      .post('/api/handover/complete')
      .send(updatedPayload);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.success).toBe(true);
    expect(secondRes.body.data.recordCount).toBe(4);

    const secondIds = secondRes.body.data.records
      .map(record => record.id)
      .sort((a, b) => a - b);
    expect(secondIds).toEqual(initialIds);

    const updatedCash = secondRes.body.data.records.find(record => record.payment_type === 1);
    expect(updatedCash).toBeDefined();
    expect(Number(updatedCash.vip_card)).toBe(updatedPayload.vipCard);
    expect(updatedCash.remarks).toBe(updatedPayload.notes);
    expect(updatedCash.takeover_person).toBe(updatedPayload.receivePerson.trim());
  });
});
