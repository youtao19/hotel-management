const validator = require("../incomeStatistics.validator");

describe("收入统计参数校验", () => {
  test("查询收入趋势时，开始和结束日期完整且格式正确应当通过", () => {
    const result = validator.readDateRange({
      startDate: "2026-02-01",
      endDate: "2026-02-10",
      roomType: "STD"
    });

    expect(result.value).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-10",
      roomType: "STD"
    });
  });

  test("查询收入趋势时，缺少日期应当保持旧接口错误格式", () => {
    const result = validator.readDateRange({ startDate: "2026-02-01" });

    expect(result.error).toEqual({
      status: 400,
      body: {
        message: "请提供开始日期和结束日期",
        error: "startDate and endDate are required"
      }
    });
  });

  test("查询收入趋势时，bucket 只能是日周月三种统计周期", () => {
    expect(validator.readSeriesBucket({ bucket: "daily" }).value).toBe("daily");

    const result = validator.readSeriesBucket({ bucket: "yearly" });
    expect(result.error).toEqual({
      status: 400,
      body: {
        message: "bucket 参数错误，请使用 daily/weekly/monthly",
        error: "Invalid bucket"
      }
    });
  });

  test("快速统计选择单日时，应当把该日期作为首卡日期", () => {
    const result = validator.readQuickStatsQuery({
      startDate: "2026-02-10",
      endDate: "2026-02-10"
    });

    expect(result.value).toEqual({ selectedToday: "2026-02-10" });
  });

  test("账单明细日期格式错误时，应当保持旧接口错误格式", () => {
    const result = validator.readBillFilters({ date: "2026/02/10" });

    expect(result.error).toEqual({
      status: 400,
      body: {
        success: false,
        message: "date 日期格式错误，请使用YYYY-MM-DD"
      }
    });
  });
});
