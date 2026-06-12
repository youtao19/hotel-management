const path = require('path');
const fs = require('fs');
const request = require('supertest');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');

async function executeSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8').trim();
  if (sql) {
    await query(sql);
  }
}

describe('交接班当前页面接口', () => {
  beforeAll(async () => {
    await query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE room_types RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE handover RESTART IDENTITY CASCADE;');

    await executeSqlFile(path.resolve(__dirname, '../../../sql/room_types.sql'));
    await executeSqlFile(path.resolve(__dirname, '../../../sql/rooms.sql'));
    await executeSqlFile(path.resolve(__dirname, '../../../sql/orders.sql'));
    await executeSqlFile(path.resolve(__dirname, '../../../sql/bills.sql'));
  });

  test('overview 一次返回当前交接班页面需要的表格、班次和昨日状态', async () => {
    const overviewRes = await request(app)
      .get('/api/handover/overview')
      .query({ date: '2025-11-02' });

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.success).toBe(true);
    expect(overviewRes.body.data.businessDate).toBe('2025-11-02');
    expect(overviewRes.body.data.currentShift).toEqual({
      code: expect.any(String),
      label: expect.any(String),
      timeRange: expect.any(String)
    });
    expect(overviewRes.body.data.currentUser).toEqual(expect.objectContaining({
      name: expect.any(String),
      role: expect.any(String)
    }));
    expect(overviewRes.body.data.yesterdayRecord).toEqual(expect.objectContaining({
      date: '2025-11-01',
      hasRecord: false,
      isComplete: false,
      reserveDefaults: {
        '现金': 320,
        '微信': 0,
        '微邮付': 0,
        '其他': 0
      }
    }));
    expect(overviewRes.body.data.paymentData.reserve).toEqual({
      '现金': 320,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });
    expect(overviewRes.body.data.specialStats).toEqual(expect.objectContaining({
      openCount: expect.any(Number),
      restCount: expect.any(Number),
      invited: expect.any(Number),
      positive: expect.any(Number)
    }));
  });

  test('handover-table 没有已保存记录时，应返回计算结果和兼容字段', async () => {
    const response = await request(app)
      .get('/api/handover/handover-table')
      .query({ date: '2025-11-02' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(expect.objectContaining({
      reserve: expect.any(Object),
      hotelIncome: expect.any(Object),
      restIncome: expect.any(Object),
      hotelDeposit: expect.any(Object),
      restDeposit: expect.any(Object),
      hotelRefund: expect.any(Object),
      restRefund: expect.any(Object),
      hotelRefundDeposit: expect.any(Object),
      restRefundDeposit: expect.any(Object),
      retainedAmount: expect.any(Object),
      handoverAmount: expect.any(Object)
    }));
    expect(response.body.data.hotelRefund).toEqual(response.body.data.hotelDeposit);
    expect(response.body.data.restRefund).toEqual(response.body.data.restDeposit);
  });

  test('complete 由后端重算表格金额，不要求前端提交整张 paymentData', async () => {
    const overviewRes = await request(app)
      .get('/api/handover/overview')
      .query({ date: '2025-11-02' });
    const expectedCashHandover = overviewRes.body.data.paymentData.handoverAmount['现金'];

    const completeRes = await request(app)
      .post('/api/handover/complete')
      .send({
        date: '2025-11-02',
        receivePerson: 'peach',
        retainedAmount: {
          '现金': 320,
          '微信': 0,
          '微邮付': 0,
          '其他': 0
        },
        vipCard: 6,
        notes: '新版单页交接完成'
      });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.data.recordCount).toBe(4);

    const saved = await query(
      `SELECT payment_type, retained, handover, remarks
       FROM handover
       WHERE date = $1::date
       ORDER BY payment_type`,
      ['2025-11-02']
    );

    expect(saved.rows).toHaveLength(4);
    expect(Number(saved.rows[0].retained)).toBe(320);
    expect(Number(saved.rows[0].handover)).toBe(expectedCashHandover);
    expect(saved.rows[0].remarks).toBe('新版单页交接完成');
  });

  test('handover-table 在 /complete 保存后返回人员、会员卡、备注和留存金额', async () => {
    const tableResponse = await request(app)
      .get('/api/handover/handover-table')
      .query({ date: '2025-11-02' });

    expect(tableResponse.status).toBe(200);
    expect(tableResponse.body.success).toBe(true);
    expect(tableResponse.body.data).toEqual(expect.objectContaining({
      vipCards: 6,
      takeoverPerson: 'peach',
      remarks: '新版单页交接完成'
    }));
    expect(tableResponse.body.data.retainedAmount['现金']).toBe(320);
  });

  test('overview.specialStats 与 /special-stats 当前各自的响应结构', async () => {
    const overview = await request(app)
      .get('/api/handover/overview')
      .query({ date: '2025-11-02' });
    const stats = await request(app)
      .get('/api/handover/special-stats')
      .query({ date: '2025-11-02' });

    expect(overview.status).toBe(200);
    expect(stats.status).toBe(200);

    for (const payload of [overview.body.data.specialStats, stats.body.data]) {
      expect(payload).toEqual({
        openCount: expect.any(Number),
        restCount: expect.any(Number),
        invited: expect.any(Number),
        positive: expect.any(Number)
      });
    }
  });
});
