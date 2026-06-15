"use strict";

jest.mock("../shiftHandover.repository", () => ({
  findBillsByBusinessDate: jest.fn(),
  findHandoverRowsByDate: jest.fn(),
  findReserveByDate: jest.fn(),
  findPreviousHandoverSummary: jest.fn(),
  findAdminMemoTasks: jest.fn(),
  getOverviewSpecialStats: jest.fn(),
  getSpecialStats: jest.fn(),
  listCompletedHandoverRecords: jest.fn(),
  saveCompletedHandover: jest.fn()
}));

jest.mock("../shiftHandover.businessRules", () => ({
  getPreviousBusinessDate: jest.fn((date) => {
    const [y, m, d] = date.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    return [
      dateObj.getFullYear(),
      String(dateObj.getMonth() + 1).padStart(2, "0"),
      String(dateObj.getDate()).padStart(2, "0")
    ].join("-");
  }),
  buildReserveDefaults: jest.fn(({ isComplete, handoverAmounts }) => ({
    "现金": 320,
    "微信": isComplete ? handoverAmounts["微信"] : 0,
    "微邮付": 0,
    "其他": 0
  })),
  resolveCurrentShift: jest.fn(() => ({
    code: "morning",
    label: "早班",
    timeRange: "08:00-16:00"
  })),
  resolveCurrentUser: jest.fn((account = {}) => ({
    id: account.id || null,
    name: account.username || "当前用户",
    role: account.role || "前台"
  }))
}));

const repository = require("../shiftHandover.repository");
const businessRules = require("../shiftHandover.businessRules");
const service = require("../shiftHandover.service");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("shiftHandover.service.getOverview", () => {
  test("overview 使用昨日完整记录生成默认备用金", async () => {
    repository.findPreviousHandoverSummary.mockResolvedValue({
      hasRecord: true,
      isComplete: true,
      paymentCount: 4,
      paymentTypes: [1, 2, 3, 4],
      handoverPerson: "A",
      takeoverPerson: "B",
      handoverAmounts: {
        "现金": 100,
        "微信": 200,
        "微邮付": 300,
        "其他": 400
      }
    });
    repository.findReserveByDate.mockResolvedValue({
      "现金": 100,
      "微信": 200,
      "微邮付": 300,
      "其他": 400
    });
    repository.findBillsByBusinessDate.mockResolvedValue([]);
    repository.getOverviewSpecialStats.mockResolvedValue({
      openCount: 0,
      restCount: 0,
      invited: 0,
      positive: 0
    });

    const result = await service.getOverview({
      date: "2026-06-12",
      account: { username: "peach" }
    });

    expect(result.yesterdayRecord.date).toBe("2026-06-11");
    expect(result.yesterdayRecord.isComplete).toBe(true);
    expect(result.paymentData.reserve).toEqual({
      "现金": 320,
      "微信": 200,
      "微邮付": 0,
      "其他": 0
    });
    expect(result.specialStats).toEqual({
      openCount: 0,
      restCount: 0,
      invited: 0,
      positive: 0
    });
    expect(businessRules.resolveCurrentShift).toHaveBeenCalled();
    expect(repository.getOverviewSpecialStats).toHaveBeenCalledWith("2026-06-12");
  });

  test("overview 在无昨日记录时备用金退回全 0（现金除外）", async () => {
    repository.findPreviousHandoverSummary.mockResolvedValue({
      hasRecord: false,
      isComplete: false,
      paymentCount: 0,
      paymentTypes: [],
      handoverPerson: null,
      takeoverPerson: null,
      handoverAmounts: { "现金": 0, "微信": 0, "微邮付": 0, "其他": 0 }
    });
    repository.findReserveByDate.mockResolvedValue(null);
    repository.findBillsByBusinessDate.mockResolvedValue([]);
    repository.getOverviewSpecialStats.mockResolvedValue({
      openCount: 1,
      restCount: 2,
      invited: 3,
      positive: 4
    });

    const result = await service.getOverview({
      date: "2026-06-12",
      account: { username: "peach" }
    });

    expect(result.yesterdayRecord.date).toBe("2026-06-11");
    expect(result.yesterdayRecord.hasRecord).toBe(false);
    expect(result.paymentData.reserve).toEqual({
      "现金": 320,
      "微信": 0,
      "微邮付": 0,
      "其他": 0
    });
  });
});

describe("shiftHandover.service.getTableData", () => {
  test("有已保存记录时直接映射数据库行", async () => {
    repository.findHandoverRowsByDate.mockResolvedValue([
      {
        payment_type: 1,
        reserve_cash: 320,
        room_income: 100,
        rest_income: 0,
        rent_income: 0,
        total_income: 420,
        room_refund: 50,
        rest_refund: 0,
        retained: 320,
        handover: 50,
        vip_card: 6,
        handover_person: "A",
        takeover_person: "peach",
        remarks: "备注"
      },
      {
        payment_type: 2,
        reserve_cash: 0,
        room_income: 0,
        rest_income: 0,
        rent_income: 0,
        total_income: 0,
        room_refund: 0,
        rest_refund: 0,
        retained: 0,
        handover: 0,
        vip_card: 0,
        handover_person: "A",
        takeover_person: "peach",
        remarks: ""
      }
    ]);

    const result = await service.getTableData("2026-06-12");

    expect(repository.findBillsByBusinessDate).not.toHaveBeenCalled();
    expect(result.vipCards).toBe(6);
    expect(result.handoverPerson).toBe("A");
    expect(result.takeoverPerson).toBe("peach");
    expect(result.remarks).toBe("备注");
    expect(result.reserve["现金"]).toBe(320);
    expect(result.hotelRefund).toEqual(result.hotelDeposit);
    expect(result.hotelRefundDeposit).toEqual(result.hotelDeposit);
  });

  test("无已保存记录时回退到计算版本", async () => {
    repository.findHandoverRowsByDate.mockResolvedValue([]);
    repository.findReserveByDate.mockResolvedValue(null);
    repository.findBillsByBusinessDate.mockResolvedValue([]);

    const result = await service.getTableData("2026-06-12");

    expect(repository.findBillsByBusinessDate).toHaveBeenCalled();
    expect(result.reserve).toEqual(expect.any(Object));
    expect(result.hotelRefundDeposit).toEqual(result.hotelDeposit);
  });
});
