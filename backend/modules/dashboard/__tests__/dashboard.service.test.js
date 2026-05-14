jest.mock("../dashboard.repository", () => ({
  deleteMemoById: jest.fn(),
  findMemosByDate: jest.fn(),
  insertMemo: jest.fn(),
  updateMemoById: jest.fn()
}));

const dashboardService = require("../dashboard.service");
const repository = require("../dashboard.repository");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("仪表盘备忘录业务规则", () => {
  test("查询备忘录时，应当把日期按 YYYY-MM-DD 传给 repository", async () => {
    repository.findMemosByDate.mockResolvedValue([{ memo_id: 1 }]);

    const result = await dashboardService.listMemos("2026-05-15T10:00:00Z");

    expect(repository.findMemosByDate).toHaveBeenCalledWith("2026-05-15");
    expect(result).toEqual({ memos: [{ memo_id: 1 }], date: "2026-05-15" });
  });

  test("创建备忘录没传优先级和完成状态时，应当使用旧接口默认值", async () => {
    repository.insertMemo.mockResolvedValue({ memo_id: 2 });

    await dashboardService.createMemo({
      memo_date: "2026-05-15",
      title: "  联系客人  "
    });

    expect(repository.insertMemo).toHaveBeenCalledWith({
      memo_date: "2026-05-15",
      title: "联系客人",
      priority: "medium",
      completed: false
    });
  });

  test("更新备忘录时，应当只做标题修剪，不改变其他字段", async () => {
    repository.updateMemoById.mockResolvedValue({ memo_id: 3 });

    await dashboardService.updateMemo(3, {
      title: "  已联系  ",
      completed: true
    });

    expect(repository.updateMemoById).toHaveBeenCalledWith(3, {
      title: "已联系",
      completed: true
    });
  });

  test("删除备忘录时，应当透传删除结果", async () => {
    repository.deleteMemoById.mockResolvedValue(false);

    await expect(dashboardService.deleteMemo(4)).resolves.toBe(false);
  });
});
