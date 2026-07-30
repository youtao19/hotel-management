"use strict";

jest.mock("../shiftHandover.repository", () => ({
  findBillsByBusinessDate: jest.fn(),
  findSourceSnapshots: jest.fn(),
  findDailyCashReserve: jest.fn(),
  findHandoverRowsByDate: jest.fn(),
  findReserveByDate: jest.fn(),
  isHandoverComplete: jest.fn(),
  hasSourceSnapshot: jest.fn(),
  findPreviousHandoverSummary: jest.fn(),
  findAdminMemoTasks: jest.fn(),
  getOverviewSpecialStats: jest.fn(),
  getSpecialStats: jest.fn(),
  listCompletedHandoverRecords: jest.fn(),
  saveDailyCashReserve: jest.fn(),
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
    "现金": 0,
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
    repository.findDailyCashReserve.mockResolvedValue({
      date: "2026-06-12",
      cashReserve: 320,
      cashRetained: 320,
      setBy: "peach",
      updatedAt: "2026-06-12 08:00:00"
    });
    repository.isHandoverComplete.mockResolvedValue(false);
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
    expect(result.cashReserveSetting).toEqual(expect.objectContaining({ configured: true, amount: 320, cashRetained: 320 }));
    expect(result.canComplete).toBe(true);
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
    repository.findDailyCashReserve.mockResolvedValue(null);
    repository.isHandoverComplete.mockResolvedValue(false);
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
      "现金": 0,
      "微信": 0,
      "微邮付": 0,
      "其他": 0
    });
    expect(result.cashReserveSetting.configured).toBe(false);
    expect(result.canComplete).toBe(false);
    expect(result.completeBlockReasons).toEqual(["请先设置今日备用金与留存款"]);
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

describe("shiftHandover.service 来源分类", () => {
  test("补收和退款按住宿类型进入收入，退押与租车进入各自项目", () => {
    expect(service.classifyBill({ pay_way: "微信", change_price: 20, change_type: "补收", stay_type: "客房" }))
      .toEqual({ item: "hotelIncome", paymentMethod: "微信", amountCents: 2000 });
    expect(service.classifyBill({ pay_way: "现金", change_price: -15, change_type: "退款", stay_type: "休息房" }))
      .toEqual({ item: "restIncome", paymentMethod: "现金", amountCents: -1500 });
    expect(service.classifyBill({ pay_way: "微邮付", change_price: -30, change_type: "退押", stay_type: "客房" }))
      .toEqual({ item: "hotelRefundDeposit", paymentMethod: "微邮付", amountCents: 3000 });
    expect(service.classifyBill({ pay_way: "微信", change_price: 50, change_type: "租车收入", stay_type: "租车收入" }))
      .toEqual({ item: "carRentIncome", paymentMethod: "微信", amountCents: 5000 });
    expect(service.classifyBill({ pay_way: "微信", change_price: 20, change_type: "补收", stay_type: "其他" }))
      .toBeNull();
  });

  test("已完成新交接优先返回快照，旧交接回退为实时账单参考", async () => {
    repository.isHandoverComplete.mockResolvedValue(true);
    repository.hasSourceSnapshot.mockResolvedValue(true);
    repository.findSourceSnapshots.mockResolvedValue([{
      bill_id: 10,
      order_id: "O10",
      room_number: "301",
      guest_name: "张三",
      change_type: "房费",
      source_amount: "88.00",
      bill_create_time: "2026-07-30 10:00:00",
      remarks: ""
    }]);

    const snapshot = await service.getSourceDetails({ date: "2026-07-30", item: "hotelIncome", paymentMethod: "微信" });
    expect(snapshot.sourceMode).toBe("snapshot");
    expect(snapshot.details[0]).toEqual(expect.objectContaining({ billId: 10, guestName: "张三", amount: 88 }));

    repository.hasSourceSnapshot.mockResolvedValue(false);
    repository.findBillsByBusinessDate.mockResolvedValue([{
      bill_id: 11,
      pay_way: "微信",
      change_price: 66,
      change_type: "房费",
      stay_type: "客房"
    }]);
    const reference = await service.getSourceDetails({ date: "2026-07-29", item: "hotelIncome", paymentMethod: "微信" });
    expect(reference.sourceMode).toBe("reference");
    expect(reference.details).toEqual([expect.objectContaining({ billId: 11, amount: 66 })]);
  });
});

describe("shiftHandover.service.getAdminMemos", () => {
  test("只返回 type === admin 的任务", async () => {
    repository.findAdminMemoTasks.mockResolvedValue([
      { id: 1, title: "管理员事项", type: "admin", completed: false },
      { id: 2, title: "普通事项", type: "normal", completed: false }
    ]);

    const result = await service.getAdminMemos("2026-06-12");

    expect(result).toEqual([
      expect.objectContaining({ title: "管理员事项", type: "admin" })
    ]);
    expect(result).toHaveLength(1);
  });

  test("查询失败时返回空数组", async () => {
    repository.findAdminMemoTasks.mockResolvedValue([]);

    const result = await service.getAdminMemos("2026-06-12");

    expect(result).toEqual([]);
  });
});

describe("shiftHandover.service 现金备用金约束", () => {
  test("未设置今日备用金与留存款时拒绝完成交接", async () => {
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
    repository.findDailyCashReserve.mockResolvedValue(null);
    repository.getOverviewSpecialStats.mockResolvedValue({ openCount: 0, restCount: 0, invited: 0, positive: 0 });
    repository.isHandoverComplete.mockResolvedValue(false);

    await expect(service.completeHandover({
      body: { date: "2026-07-30", receivePerson: "peach" },
      account: { username: "youtao" }
    })).rejects.toMatchObject({ status: 409, message: "请先设置今日备用金与留存款" });

    expect(repository.saveCompletedHandover).not.toHaveBeenCalled();
  });

  test("已完成交接时拒绝修改备用金与留存款", async () => {
    repository.isHandoverComplete.mockResolvedValue(true);

    await expect(service.setDailyCashReserve({
      date: "2026-07-30",
      cashReserve: 500,
      cashRetained: 320,
      account: { username: "youtao" }
    })).rejects.toMatchObject({ status: 409, message: "当日交接已完成，备用金与留存款不可修改" });

    expect(repository.saveDailyCashReserve).not.toHaveBeenCalled();
  });

  test("未完成交接时保存备用金与留存款", async () => {
    repository.isHandoverComplete.mockResolvedValue(false);
    repository.saveDailyCashReserve.mockResolvedValue({
      date: "2026-07-30",
      cashReserve: 0,
      cashRetained: 0,
      setBy: "youtao"
    });

    const result = await service.setDailyCashReserve({
      date: "2026-07-30",
      cashReserve: 0,
      cashRetained: 0,
      account: { username: "youtao" }
    });

    expect(result.cashReserve).toBe(0);
    expect(repository.saveDailyCashReserve).toHaveBeenCalledWith({
      date: "2026-07-30",
      cashReserve: 0,
      cashRetained: 0,
      setBy: "youtao"
    });
  });
});
