jest.mock("../dashboard.service", () => ({
  createMemo: jest.fn(),
  deleteMemo: jest.fn(),
  listMemos: jest.fn(),
  updateMemo: jest.fn()
}));

const controller = require("../dashboard.controller");
const dashboardService = require("../dashboard.service");

function createRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn()
  };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("仪表盘备忘录业务调用", () => {
  test("查询备忘录时，应当保持旧接口的 data 和 date 响应格式", async () => {
    const req = { query: { date: "2026-05-15" } };
    const res = createRes();
    const memos = [{ memo_id: 1, title: "联系客人" }];
    dashboardService.listMemos.mockResolvedValue({ memos, date: "2026-05-15" });

    await controller.listMemos(req, res);

    expect(dashboardService.listMemos).toHaveBeenCalledWith("2026-05-15");
    expect(res.json).toHaveBeenCalledWith({ data: memos, date: "2026-05-15" });
  });

  test("创建备忘录时，应当修剪标题并保持 201 响应格式", async () => {
    const req = {
      body: {
        memo_date: "2026-05-15",
        title: "  联系客人  "
      }
    };
    const res = createRes();
    const memo = { memo_id: 2, title: "联系客人", priority: "medium" };
    dashboardService.createMemo.mockResolvedValue(memo);

    await controller.createMemo(req, res);

    expect(dashboardService.createMemo).toHaveBeenCalledWith({
      memo_date: "2026-05-15",
      title: "联系客人"
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: memo });
  });

  test("创建备忘录日期格式错误时，应当保持旧接口的校验错误格式", async () => {
    const req = { body: { memo_date: "2026/05/15", title: "联系客人" } };
    const res = createRes();

    await controller.createMemo(req, res);

    expect(dashboardService.createMemo).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "请求数据格式错误",
      errors: expect.arrayContaining([expect.objectContaining({ instancePath: "/memo_date" })])
    });
  });

  test("更新不存在的备忘录时，应当返回旧接口的 404 响应", async () => {
    const req = {
      params: { memoId: "99" },
      body: { completed: true }
    };
    const res = createRes();
    dashboardService.updateMemo.mockResolvedValue(null);

    await controller.updateMemo(req, res);

    expect(dashboardService.updateMemo).toHaveBeenCalledWith(99, { completed: true });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "备忘录不存在" });
  });

  test("删除备忘录成功时，应当保持 204 无响应体", async () => {
    const req = { params: { memoId: "8" } };
    const res = createRes();
    dashboardService.deleteMemo.mockResolvedValue(true);

    await controller.deleteMemo(req, res);

    expect(dashboardService.deleteMemo).toHaveBeenCalledWith(8);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });
});
