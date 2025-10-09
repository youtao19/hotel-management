/**
 * 测试文件：完成交接班 API 接口
 *
 * 本测试使用 Jest Mock 来模拟数据库和 Redis，避免依赖真实数据库
 *
 * Mock 文件位置：
 * - backend/database/__mocks__/postgreDB/pg.js（PostgreSQL mock）
 * - backend/database/__mocks__/redis/redis.js（Redis mock）
 *
 * 注意：Redis mock 必须在这里内联定义，因为 connect-redis
 * 需要在模块加载时就获得真实的 client 对象
 */
const request = require('supertest');

// ==================== Mock 数据库模块 ====================
// 注意：必须在 require app 之前进行 mock

// 创建 Redis 客户端 mock - 必须是真实对象，不能是 jest.fn()
// connect-redis 会检查 options.client 是否存在
const mockRedisClient = {
  get: jest.fn((key, cb) => cb && cb(null, null)),
  set: jest.fn((key, value, cb) => cb && cb(null, 'OK')),
  del: jest.fn((key, cb) => cb && cb(null, 1)),
  quit: jest.fn((cb) => cb && cb(null)),
  on: jest.fn(),
  status: 'ready',
  connected: true
};

// Mock PostgreSQL 数据库模块 - 使用 __mocks__ 目录中的文件
jest.mock('../../database/postgreDB/pg');

// Mock Redis 模块 - 内联定义，确保 initialize() 返回真实对象
jest.mock('../../database/redis/redis', () => ({
  initialize: jest.fn(() => mockRedisClient),
  getClient: jest.fn(() => mockRedisClient),
  close: jest.fn(() => Promise.resolve())
}));

// ==================== 导入模块 ====================
const { getClient } = require('../../database/postgreDB/pg');
const app = require('../../app');

describe('POST /api/handover/complete 接口测试', () => {

  let mockQuery;
  let mockRelease;
  let mockClient;

  beforeEach(() => {
    // 重置所有 mocks，避免测试之间互相影响
    jest.clearAllMocks();

    // 创建 mock 的数据库 client
    mockQuery = jest.fn();
    mockRelease = jest.fn();
    mockClient = {
      query: mockQuery,
      release: mockRelease
    };

    // 配置 getClient 返回 mock 的 client
    // 这样路由中的 getClient() 调用会返回我们控制的 mock 对象
    getClient.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------
  // 参数验证测试
  // -------------------------
  test('缺少 date 返回 400', async () => {
    const res = await request(app)
      .post('/api/handover/complete')
      .send({ receivePerson: '小明', paymentData: {} });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('缺少必需的日期参数');
  });

  test('缺少 receivePerson 返回 400', async () => {
    const res = await request(app)
      .post('/api/handover/complete')
      .send({ date: '2025-10-09', paymentData: {} });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('请输入接班人员姓名');
  });

  test('缺少 paymentData 返回 400', async () => {
    const res = await request(app)
      .post('/api/handover/complete')
      .send({ date: '2025-10-09', receivePerson: '小明' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('缺少支付数据');
  });

  // -------------------------
  // 功能逻辑测试
  // -------------------------
  test('保存全部支付方式记录，现金记录包含 VIP 和 taskList', async () => {
    // 模拟数据库返回数据 - 需要 BEGIN, 4条INSERT, COMMIT
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{
        id: 1,
        payment_type: 1,
        vip_card: 123,
        task_list: JSON.stringify(['打扫房间', '结算账单']),
        remarks: '交接顺利'
      }] }) // 现金
      .mockResolvedValueOnce({ rows: [{
        id: 2,
        payment_type: 2,
        vip_card: 0,
        task_list: '[]',
        remarks: ''
      }] }) // 微信
      .mockResolvedValueOnce({ rows: [{
        id: 3,
        payment_type: 3,
        vip_card: 0,
        task_list: '[]',
        remarks: ''
      }] }) // 微邮付
      .mockResolvedValueOnce({ rows: [{
        id: 4,
        payment_type: 4,
        vip_card: 0,
        task_list: '[]',
        remarks: ''
      }] }) // 其他
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const paymentData = {
      reserve: { '现金': 100, '微信': 50, '微邮付': 20, '其他': 10 },
      hotelIncome: { '现金': 200, '微信': 150, '微邮付': 100, '其他': 50 },
      restIncome: { '现金': 50, '微信': 25, '微邮付': 15, '其他': 5 },
      carRentIncome: { '现金': 30, '微信': 0, '微邮付': 0, '其他': 0 },
      totalIncome: { '现金': 380, '微信': 225, '微邮付': 135, '其他': 55 },
      hotelDeposit: { '现金': 10, '微信': 5, '微邮付': 2, '其他': 1 },
      restDeposit: { '现金': 5, '微信': 2, '微邮付': 1, '其他': 0 },
      retainedAmount: { '现金': 50, '微信': 10, '微邮付': 5, '其他': 2 },
      handoverAmount: { '现金': 275, '微信': 208, '微邮付': 127, '其他': 52 }
    };
    const taskList = ['打扫房间', '结算账单'];
    const notes = '交接顺利';

    const res = await request(app)
      .post('/api/handover/complete')
      .send({
        date: '2025-10-09',
        handoverPerson: '小红',
        receivePerson: '小明',
        paymentData,
        vipCard: 123,
        taskList,
        notes
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.records).toHaveLength(4); // 4 种支付方式

    const cashRecord = res.body.data.records.find(r => r.payment_type === 1);
    expect(cashRecord.vip_card).toBe(123);
    expect(JSON.parse(cashRecord.task_list)).toEqual(taskList);
    expect(cashRecord.remarks).toBe(notes);

    const wechatRecord = res.body.data.records.find(r => r.payment_type === 2);
    expect(wechatRecord.vip_card).toBe(0);
    expect(wechatRecord.task_list).toBe('[]');
    expect(wechatRecord.remarks).toBe('');
  });

  // -------------------------
  // 异常处理测试
  // -------------------------
  test('数据库抛错时返回 500 并回滚', async () => {
    // BEGIN 成功，但第一个 INSERT 失败
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('数据库错误')); // 第一个 INSERT 失败

    const paymentData = {
      reserve: { '现金': 100, '微信': 50, '微邮付': 20, '其他': 10 },
      hotelIncome: { '现金': 200, '微信': 150, '微邮付': 100, '其他': 50 },
      restIncome: { '现金': 50, '微信': 25, '微邮付': 15, '其他': 5 },
      carRentIncome: { '现金': 30, '微信': 0, '微邮付': 0, '其他': 0 },
      totalIncome: { '现金': 380, '微信': 225, '微邮付': 135, '其他': 55 },
      hotelDeposit: { '现金': 10, '微信': 5, '微邮付': 2, '其他': 1 },
      restDeposit: { '现金': 5, '微信': 2, '微邮付': 1, '其他': 0 },
      retainedAmount: { '现金': 50, '微信': 10, '微邮付': 5, '其他': 2 },
      handoverAmount: { '现金': 275, '微信': 208, '微邮付': 127, '其他': 52 }
    };

    const res = await request(app)
      .post('/api/handover/complete')
      .send({
        date: '2025-10-09',
        receivePerson: '小明',
        handoverPerson: '小红',
        paymentData
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('数据库错误');
    expect(mockRelease).toHaveBeenCalled();
  });

});
