/**
 * 交接班路由测试文件
 *
 * 测试覆盖：
 * 1. GET /api/handover/table - 获取交接班表格数据（计算版本）
 * 2. GET /api/handover/handover-table - 获取交接班表格数据（从handover表查询）
 * 3. GET /api/handover/remarks - 获取备忘录数据
 * 4. GET /api/handover/special-stats - 获取交接班特殊统计
 * 5. GET /api/handover/dates - 获取可访问日期列表
 * 6. GET /api/handover/dates-flexible - 获取可访问日期列表（宽松模式）
 * 7. POST /api/handover/start - 开始交接班
 * 8. POST /api/handover/save-amounts - 保存页面数据
 * 9. GET /api/handover/admin-memos - 获取管理员备忘录
 * 10. POST /api/handover/save-admin-memo - 保存管理员备忘录
 *
 * 每个路由都测试了正常流程和各种错误情况，包括：
 * - 成功响应
 * - 参数验证失败
 * - 业务逻辑错误
 * - 服务器内部错误
 */

const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');

// Mock handoverModule
jest.mock('../modules/handoverModule');
const handoverModule = require('../modules/handoverModule');

describe('Handover Routes Tests', () => {
  beforeEach(async () => {
    // 重置所有 mock
    jest.clearAllMocks();

    // 清理测试数据
    if (global.cleanupTestData) {
      await global.cleanupTestData();
    }
  });

  describe('GET /api/handover/table', () => {
    it('应该成功获取交接班表格数据', async () => {
      const mockTableData = {
        reserve: { '现金': 100, '微信': 200, '微邮付': 0, '其他': 0 },
        hotelIncome: { '现金': 500, '微信': 800, '微邮付': 100, '其他': 50 },
        totalIncome: { '现金': 600, '微信': 1000, '微邮付': 100, '其他': 50 }
      };

      handoverModule.getShiftTable.mockResolvedValue(mockTableData);

      const res = await request(app)
        .get('/api/handover/table?date=2024-01-01');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockTableData);
      expect(handoverModule.getShiftTable).toHaveBeenCalledWith('2024-01-01');
    });

    it('当发生错误时应该返回500', async () => {
      handoverModule.getShiftTable.mockRejectedValue(new Error('数据库错误'));

      const res = await request(app)
        .get('/api/handover/table?date=2024-01-01');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('服务器错误');
    });
  });

  describe('GET /api/handover/handover-table', () => {
    it('应该成功获取交接班表格数据（从handover表查询）', async () => {
      const mockTableData = {
        date: '2024-01-01',
        paymentData: { '现金': 1000, '微信': 2000 },
        specialStats: { roomCount: 10, restCount: 5 }
      };

      handoverModule.getHandoverTableData.mockResolvedValue(mockTableData);

      const res = await request(app)
        .get('/api/handover/handover-table?date=2024-01-01');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockTableData);
      expect(handoverModule.getHandoverTableData).toHaveBeenCalledWith('2024-01-01');
    });

    it('缺少日期参数时应该返回400', async () => {
      const res = await request(app)
        .get('/api/handover/handover-table');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少必需的日期参数');
    });

    it('当发生错误时应该返回500', async () => {
      handoverModule.getHandoverTableData.mockRejectedValue(new Error('获取数据失败'));

      const res = await request(app)
        .get('/api/handover/handover-table?date=2024-01-01');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('获取数据失败');
    });
  });

  describe('GET /api/handover/remarks', () => {
    it('应该成功获取备忘录数据', async () => {
      const mockRemarks = [
        { id: 1, content: '测试备忘录1', date: '2024-01-01' },
        { id: 2, content: '测试备忘录2', date: '2024-01-01' }
      ];

      handoverModule.getRemarks.mockResolvedValue(mockRemarks);

      const res = await request(app)
        .get('/api/handover/remarks?date=2024-01-01');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockRemarks);
      expect(handoverModule.getRemarks).toHaveBeenCalledWith({ date: '2024-01-01' });
    });

    it('当发生错误时应该返回400', async () => {
      handoverModule.getRemarks.mockRejectedValue(new Error('无效的日期格式'));

      const res = await request(app)
        .get('/api/handover/remarks?date=invalid-date');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('无效的日期格式');
    });
  });

  describe('GET /api/handover/special-stats', () => {
    it('应该成功获取交接班特殊统计', async () => {
      const mockStats = {
        roomCount: 15,
        restCount: 8,
        goodReviewInvited: 5,
        goodReviewReceived: 3
      };

      handoverModule.getShiftSpecialStats.mockResolvedValue(mockStats);

      const res = await request(app)
        .get('/api/handover/special-stats?date=2024-01-01');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockStats);
      expect(handoverModule.getShiftSpecialStats).toHaveBeenCalledWith('2024-01-01');
    });

    it('当发生错误时应该返回500', async () => {
      handoverModule.getShiftSpecialStats.mockRejectedValue(new Error('统计数据获取失败'));

      const res = await request(app)
        .get('/api/handover/special-stats?date=2024-01-01');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('统计数据获取失败');
    });
  });

  describe('GET /api/handover/dates', () => {
    it('应该成功获取可访问日期列表', async () => {
      const mockDates = ['2024-01-01', '2024-01-02', '2024-01-03'];

      handoverModule.getAvailableDates.mockResolvedValue(mockDates);

      const res = await request(app)
        .get('/api/handover/dates');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockDates);
      expect(handoverModule.getAvailableDates).toHaveBeenCalled();
    });

    it('当发生错误时应该返回500', async () => {
      handoverModule.getAvailableDates.mockRejectedValue(new Error('获取日期失败'));

      const res = await request(app)
        .get('/api/handover/dates');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('获取日期失败');
    });
  });

  describe('GET /api/handover/dates-flexible', () => {
    it('应该成功获取可访问日期列表（宽松模式）', async () => {
      const mockDates = ['2024-01-01', '2024-01-02'];

      handoverModule.getAvailableDatesFlexible.mockResolvedValue(mockDates);

      const res = await request(app)
        .get('/api/handover/dates-flexible');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockDates);
      expect(handoverModule.getAvailableDatesFlexible).toHaveBeenCalled();
    });

    it('当发生错误时应该返回500', async () => {
      handoverModule.getAvailableDatesFlexible.mockRejectedValue(new Error('获取日期失败（宽松模式）'));

      const res = await request(app)
        .get('/api/handover/dates-flexible');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('获取日期失败（宽松模式）');
    });
  });

  describe('POST /api/handover/start', () => {
    const validRequestBody = {
      date: '2024-01-01',
      paymentData: {
        '现金': 1000,
        '微信': 2000,
        '微邮付': 500,
        '其他': 100
      }
    };

    it('应该成功开始交接班', async () => {
      const mockResult = {
        success: true,
        message: '交接班创建成功',
        handoverId: 1
      };

      handoverModule.startHandover.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/handover/start')
        .send(validRequestBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(res.body.message).toBe('交接班创建成功');
      expect(handoverModule.startHandover).toHaveBeenCalledWith(validRequestBody);
    });

    it('请求数据为空时应该返回400', async () => {
      const res = await request(app)
        .post('/api/handover/start')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('请求数据为空');
    });

    it('缺少日期参数时应该返回400', async () => {
      const invalidBody = {
        paymentData: { '现金': 1000 }
      };

      const res = await request(app)
        .post('/api/handover/start')
        .send(invalidBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少必需的日期参数');
    });

    it('缺少支付数据时应该返回400', async () => {
      const invalidBody = {
        date: '2024-01-01'
      };

      const res = await request(app)
        .post('/api/handover/start')
        .send(invalidBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少支付数据');
    });

    it('数据格式错误时应该返回400', async () => {
      handoverModule.startHandover.mockRejectedValue(new Error('日期格式不正确'));

      const res = await request(app)
        .post('/api/handover/start')
        .send(validRequestBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('日期格式不正确');
    });

    it('数据已存在时应该返回409', async () => {
      handoverModule.startHandover.mockRejectedValue(new Error('交接班记录已存在'));

      const res = await request(app)
        .post('/api/handover/start')
        .send(validRequestBody);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('交接班记录已存在');
    });

    it('服务器错误时应该返回500', async () => {
      handoverModule.startHandover.mockRejectedValue(new Error('数据库连接失败'));

      const res = await request(app)
        .post('/api/handover/start')
        .send(validRequestBody);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('数据库连接失败');
    });
  });

  describe('POST /api/handover/save-amounts', () => {
    const validRequestBody = {
      date: '2024-01-01',
      paymentData: {
        '现金': 1000,
        '微信': 2000
      },
      specialStats: {
        roomCount: 10,
        restCount: 5
      }
    };

    it('应该成功保存页面数据', async () => {
      const mockResult = {
        success: true,
        message: '数据保存成功'
      };

      handoverModule.saveAmountChanges.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/handover/save-amounts')
        .send(validRequestBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(res.body.message).toBe('页面数据保存成功');
      expect(handoverModule.saveAmountChanges).toHaveBeenCalledWith(validRequestBody);
    });

    it('请求数据为空时应该返回400', async () => {
      const res = await request(app)
        .post('/api/handover/save-amounts')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('请求数据为空');
    });

    it('缺少日期参数时应该返回400', async () => {
      const invalidBody = {
        paymentData: { '现金': 1000 }
      };

      const res = await request(app)
        .post('/api/handover/save-amounts')
        .send(invalidBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少必需的日期参数');
    });

    it('保存失败时应该返回500', async () => {
      handoverModule.saveAmountChanges.mockRejectedValue(new Error('保存数据失败'));

      const res = await request(app)
        .post('/api/handover/save-amounts')
        .send(validRequestBody);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('保存数据失败');
    });
  });

  describe('GET /api/handover/admin-memos', () => {
    it('应该成功获取管理员备忘录', async () => {
      const mockMemos = [
        { id: 1, memo: '管理员备忘录1', date: '2024-01-01' },
        { id: 2, memo: '管理员备忘录2', date: '2024-01-01' }
      ];

      handoverModule.getAdminMemosFromHandover.mockResolvedValue(mockMemos);

      const res = await request(app)
        .get('/api/handover/admin-memos?date=2024-01-01');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockMemos);
      expect(res.body.message).toBe('获取管理员备忘录成功');
      expect(handoverModule.getAdminMemosFromHandover).toHaveBeenCalledWith('2024-01-01');
    });

    it('缺少日期参数时应该返回400', async () => {
      const res = await request(app)
        .get('/api/handover/admin-memos');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少必需的日期参数');
    });

    it('当发生错误时应该返回500', async () => {
      handoverModule.getAdminMemosFromHandover.mockRejectedValue(new Error('获取备忘录失败'));

      const res = await request(app)
        .get('/api/handover/admin-memos?date=2024-01-01');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('获取备忘录失败');
    });
  });

  describe('POST /api/handover/save-admin-memo', () => {
    const validRequestBody = {
      date: '2024-01-01',
      memo: '这是一个管理员备忘录'
    };

    it('应该成功保存管理员备忘录', async () => {
      const mockResult = {
        success: true,
        message: '备忘录保存成功',
        data: { id: 1, memo: '这是一个管理员备忘录', date: '2024-01-01' }
      };

      handoverModule.saveAdminMemoToHandover.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/handover/save-admin-memo')
        .send(validRequestBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult.data);
      expect(res.body.message).toBe('备忘录保存成功');
      expect(handoverModule.saveAdminMemoToHandover).toHaveBeenCalledWith({
        date: '2024-01-01',
        memo: '这是一个管理员备忘录'
      });
    });

    it('请求数据为空时应该返回400', async () => {
      const res = await request(app)
        .post('/api/handover/save-admin-memo')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('请求数据为空');
    });

    it('缺少日期参数时应该返回400', async () => {
      const invalidBody = {
        memo: '备忘录内容'
      };

      const res = await request(app)
        .post('/api/handover/save-admin-memo')
        .send(invalidBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少必需的日期参数');
    });

    it('备忘录内容为空时应该返回400', async () => {
      const invalidBody = {
        date: '2024-01-01',
        memo: ''
      };

      const res = await request(app)
        .post('/api/handover/save-admin-memo')
        .send(invalidBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('备忘录内容不能为空');
    });

    it('备忘录内容仅为空格时应该返回400', async () => {
      const invalidBody = {
        date: '2024-01-01',
        memo: '   '
      };

      const res = await request(app)
        .post('/api/handover/save-admin-memo')
        .send(invalidBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('备忘录内容不能为空');
    });

    it('应该正确处理备忘录内容的空格', async () => {
      const mockResult = {
        success: true,
        message: '备忘录保存成功',
        data: { id: 1, memo: '备忘录内容', date: '2024-01-01' }
      };

      handoverModule.saveAdminMemoToHandover.mockResolvedValue(mockResult);

      const requestBody = {
        date: '2024-01-01',
        memo: '  备忘录内容  '
      };

      const res = await request(app)
        .post('/api/handover/save-admin-memo')
        .send(requestBody);

      expect(res.status).toBe(200);
      expect(handoverModule.saveAdminMemoToHandover).toHaveBeenCalledWith({
        date: '2024-01-01',
        memo: '备忘录内容'
      });
    });

    it('保存失败时应该返回500', async () => {
      handoverModule.saveAdminMemoToHandover.mockRejectedValue(new Error('数据库错误'));

      const res = await request(app)
        .post('/api/handover/save-admin-memo')
        .send(validRequestBody);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('数据库错误');
    });
  });
});
