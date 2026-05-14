jest.mock("../review.service", () => ({
  getReviewByOrderId: jest.fn(),
  getReviewStatistics: jest.fn(),
  inviteReview: jest.fn(),
  listAllReviews: jest.fn(),
  listPendingInvitations: jest.fn(),
  listPendingReviews: jest.fn(),
  updateReviewStatus: jest.fn()
}));

const controller = require("../review.controller");
const reviewService = require("../review.service");

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

describe("好评邀请业务调用", () => {
  test("邀请好评时，应当调用好评业务层并保持响应格式不变", async () => {
    const req = { params: { orderId: "ORDER_001" } };
    const res = createRes();
    const updatedOrder = { order_id: "ORDER_001", review_invited: true };
    reviewService.inviteReview.mockResolvedValue({
      order: { order_id: "ORDER_001", guest_name: "张三" },
      reviewOrder: updatedOrder
    });

    await controller.inviteReview(req, res);

    expect(reviewService.inviteReview).toHaveBeenCalledWith("ORDER_001");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "已成功邀请客户 张三 参与好评",
      order: updatedOrder
    });
  });

  test("邀请不存在的订单时，应当保持旧接口的 404 响应", async () => {
    const req = { params: { orderId: "MISSING_ORDER" } };
    const res = createRes();
    const error = new Error("订单不存在");
    error.statusCode = 404;
    reviewService.inviteReview.mockRejectedValue(error);

    await controller.inviteReview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "订单不存在" });
  });
});

describe("好评状态业务调用", () => {
  test("设置评价状态时，应当保持原来的响应格式不变", async () => {
    const req = {
      params: { orderId: "ORDER_002" },
      body: { positive_review: false }
    };
    const res = createRes();
    const updatedOrder = { order_id: "ORDER_002", positive_review: false };
    reviewService.updateReviewStatus.mockResolvedValue({
      order: { order_id: "ORDER_002", guest_name: "李四" },
      reviewOrder: updatedOrder
    });

    await controller.updateReviewStatus(req, res);

    expect(reviewService.updateReviewStatus).toHaveBeenCalledWith("ORDER_002", false);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "已将客户 李四 的评价设置为未好评",
      order: updatedOrder
    });
  });

  test("设置评价状态没传 positive_review 时，应当返回旧接口的校验错误格式", async () => {
    const req = {
      params: { orderId: "ORDER_002" },
      body: {}
    };
    const res = createRes();

    await controller.updateReviewStatus(req, res);

    expect(reviewService.updateReviewStatus).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "请求数据验证失败",
      errors: expect.arrayContaining([
        expect.objectContaining({ field: "positive_review" })
      ])
    });
  });

  test("未邀请订单设置评价状态时，应当拒绝更新", async () => {
    const req = {
      params: { orderId: "ORDER_003" },
      body: { positive_review: true }
    };
    const res = createRes();
    const error = new Error("尚未邀请好评，无法设置好评状态");
    error.statusCode = 400;
    reviewService.updateReviewStatus.mockRejectedValue(error);

    await controller.updateReviewStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "尚未邀请好评，无法设置好评状态" });
  });
});

describe("好评列表和统计业务调用", () => {
  test("查询所有好评记录时，应当透传日期和状态筛选", async () => {
    const req = { query: { startDate: "2026-05-01", endDate: "2026-05-14", status: "positive" } };
    const res = createRes();
    reviewService.listAllReviews.mockResolvedValue([{ order_id: "ORDER_004" }]);

    await controller.listAllReviews(req, res);

    expect(reviewService.listAllReviews).toHaveBeenCalledWith({
      startDate: "2026-05-01",
      endDate: "2026-05-14",
      status: "positive"
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "获取所有好评记录成功",
      orders: [{ order_id: "ORDER_004" }]
    });
  });

  test("查询好评统计时，应当保持旧接口的展开响应格式", async () => {
    const req = { query: { startDate: "2026-05-01", endDate: "2026-05-14" } };
    const res = createRes();
    reviewService.getReviewStatistics.mockResolvedValue({
      total_invitations: "3",
      positive_reviews: "2"
    });

    await controller.getReviewStatistics(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "获取好评统计成功",
      total_invitations: "3",
      positive_reviews: "2"
    });
  });
});
