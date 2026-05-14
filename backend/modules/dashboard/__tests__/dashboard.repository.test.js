jest.mock("../../../database/postgreDB/pg", () => ({
  query: jest.fn()
}));

const { query } = require("../../../database/postgreDB/pg");
const repository = require("../dashboard.repository");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("仪表盘备忘录数据库访问", () => {
  test("按日期查询备忘录时，应当只使用 YYYY-MM-DD 字符串参数", async () => {
    query.mockResolvedValue({ rows: [{ memo_id: 1 }] });

    const rows = await repository.findMemosByDate("2026-05-15");

    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE memo_date = $1"), ["2026-05-15"]);
    expect(rows).toEqual([{ memo_id: 1 }]);
  });

  test("创建备忘录时，应当写入旧表并返回完整字段", async () => {
    query.mockResolvedValue({ rows: [{ memo_id: 2 }] });

    await repository.insertMemo({
      memo_date: "2026-05-15",
      title: "联系客人",
      priority: "medium",
      completed: false
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO dashboard_memos"),
      ["2026-05-15", "联系客人", "medium", false]
    );
  });

  test("更新备忘录时，应当拒绝空更新", async () => {
    await expect(repository.updateMemoById(1, {})).rejects.toThrow("没有提供有效的更新字段");
  });

  test("删除备忘录时，应当按 rowCount 返回是否删除成功", async () => {
    query.mockResolvedValue({ rowCount: 1 });

    await expect(repository.deleteMemoById(1)).resolves.toBe(true);
  });
});
