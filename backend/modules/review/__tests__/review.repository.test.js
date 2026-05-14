jest.mock("../../../database/postgreDB/pg", () => ({
  ...jest.requireActual("../../../database/postgreDB/pg"),
  query: jest.fn()
}));

const { query } = require("../../../database/postgreDB/pg");
const repository = require("../review.repository");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("好评记录数据库访问", () => {
  test("邀请好评时，应当继续写入 review_invitations 并返回订单好评信息", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await repository.inviteReview("ORDER_001");

    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO review_invitations"), ["ORDER_001"]);
    expect(query.mock.calls[0][0]).toContain("ON CONFLICT (order_id)");
  });

  test("更新评价状态时，应当继续写入 positive_review 和 update_time", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await repository.updateReviewStatus("ORDER_002", false);

    expect(query).toHaveBeenCalledWith(expect.stringContaining("positive_review"), ["ORDER_002", false]);
    expect(query.mock.calls[0][0]).toContain("update_time");
  });

  test("查询所有好评记录时，应当按日期和评价状态拼接原有过滤条件", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await repository.getAllReviewOrders({
      startDate: "2026-05-01",
      endDate: "2026-05-14",
      status: "positive"
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("o.check_out_date >= $1");
    expect(sql).toContain("o.check_out_date <= $2");
    expect(sql).toContain("ri.positive_review = TRUE");
    expect(params).toEqual(["2026-05-01", "2026-05-14"]);
  });

  test("查询好评统计时，应当保持原来的统计字段", async () => {
    query.mockResolvedValueOnce({ rows: [{ total_invitations: "2" }] });

    const result = await repository.getReviewStatistics({});

    const [sql] = query.mock.calls[0];
    expect(sql).toContain("total_invitations");
    expect(sql).toContain("positive_reviews");
    expect(sql).toContain("negative_reviews");
    expect(sql).toContain("pending_reviews");
    expect(sql).toContain("positive_rate");
    expect(result).toEqual({ total_invitations: "2" });
  });
});
