jest.mock("../incomeStatistics.service", () => ({
  getDailyDetails: jest.fn(),
  getQuickStats: jest.fn(),
  getRevenueBills: jest.fn(),
  getRoomTypeRevenue: jest.fn(),
  getSeries: jest.fn()
}));

const controller = require("../incomeStatistics.controller");
const service = require("../incomeStatistics.service");

function createRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn()
  };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("收入统计业务调用", () => {
  test("查询收入趋势时，应当按统计周期调用业务层并保持响应格式", async () => {
    const req = {
      query: {
        startDate: "2026-02-01",
        endDate: "2026-02-10",
        bucket: "daily",
        roomType: "STD"
      }
    };
    const res = createRes();
    service.getSeries.mockResolvedValue([{ date: "2026-02-10", total_revenue: 100 }]);

    await controller.getSeries(req, res);

    expect(service.getSeries).toHaveBeenCalledWith({
      startDate: "2026-02-01",
      endDate: "2026-02-10",
      bucket: "daily",
      roomType: "STD"
    });
    expect(res.json).toHaveBeenCalledWith({
      message: "获取收入聚合序列成功",
      data: [{ date: "2026-02-10", total_revenue: 100 }],
      period: {
        startDate: "2026-02-01",
        endDate: "2026-02-10",
        bucket: "daily",
        roomType: "STD"
      }
    });
  });

  test("快速统计选择单日时，应当透传所选日期并保持旧响应格式", async () => {
    const req = {
      query: {
        startDate: "2026-02-10",
        endDate: "2026-02-10"
      }
    };
    const res = createRes();
    service.getQuickStats.mockResolvedValue({
      data: {
        today: { total_revenue: 330, label: "2026-02-10 收入" },
        thisWeek: { total_revenue: 330 },
        thisMonth: { total_revenue: 330 }
      }
    });

    await controller.getQuickStats(req, res);

    expect(service.getQuickStats).toHaveBeenCalledWith("2026-02-10");
    expect(res.json).toHaveBeenCalledWith({
      message: "获取快速统计数据成功",
      data: {
        today: { total_revenue: 330, label: "2026-02-10 收入" },
        thisWeek: { total_revenue: 330 },
        thisMonth: { total_revenue: 330 }
      }
    });
  });

  test("查询每日营收明细时，应当保持 success 和 message 格式", async () => {
    const req = {
      query: {
        startDate: "2026-02-10",
        endDate: "2026-02-10"
      }
    };
    const res = createRes();
    service.getDailyDetails.mockResolvedValue([{ order_number: "ORDER_001" }]);

    await controller.getDailyDetails(req, res);

    expect(service.getDailyDetails).toHaveBeenCalledWith({
      startDate: "2026-02-10",
      endDate: "2026-02-10",
      roomType: undefined
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ order_number: "ORDER_001" }],
      message: "获取每日营收明细成功，共 1 条记录"
    });
  });
});
