jest.mock("../../order-manage/orderManage.service", () => ({
  getOrder: jest.fn()
}));

jest.mock("../review.repository", () => ({
  getAllReviewOrders: jest.fn(),
  getOrderWithReviewInfo: jest.fn(),
  getPendingReviewInvitations: jest.fn(),
  getPendingReviewUpdates: jest.fn(),
  getReviewByOrderId: jest.fn(),
  getReviewStatistics: jest.fn(),
  inviteReview: jest.fn(),
  updateReviewStatus: jest.fn()
}));

const orderManageService = require("../../order-manage/orderManage.service");
const reviewRepository = require("../review.repository");
const reviewService = require("../review.service");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("好评邀请业务流程", () => {
  test("邀请好评时，应当先确认订单存在，再写入邀请记录", async () => {
    const order = { order_id: "ORDER_001", guest_name: "张三" };
    const reviewOrder = { order_id: "ORDER_001", review_invited: true };
    orderManageService.getOrder.mockResolvedValue([order]);
    reviewRepository.getOrderWithReviewInfo.mockResolvedValue(reviewOrder);

    const result = await reviewService.inviteReview("ORDER_001");

    expect(orderManageService.getOrder).toHaveBeenCalledWith("ORDER_001");
    expect(reviewRepository.inviteReview).toHaveBeenCalledWith("ORDER_001");
    expect(result).toEqual({ order, reviewOrder });
  });

  test("订单不存在时，不应当写入邀请记录", async () => {
    orderManageService.getOrder.mockResolvedValue(null);

    await expect(reviewService.inviteReview("MISSING_ORDER")).rejects.toMatchObject({
      statusCode: 404,
      message: "订单不存在"
    });
    expect(reviewRepository.inviteReview).not.toHaveBeenCalled();
  });
});

describe("好评状态业务流程", () => {
  test("设置评价状态时，应当先确认已邀请，再更新状态", async () => {
    const order = { order_id: "ORDER_002", guest_name: "李四" };
    const reviewOrder = { order_id: "ORDER_002", positive_review: true };
    orderManageService.getOrder.mockResolvedValue([order]);
    reviewRepository.getReviewByOrderId.mockResolvedValue({ order_id: "ORDER_002", invited: true });
    reviewRepository.getOrderWithReviewInfo.mockResolvedValue(reviewOrder);

    const result = await reviewService.updateReviewStatus("ORDER_002", true);

    expect(reviewRepository.getReviewByOrderId).toHaveBeenCalledWith("ORDER_002");
    expect(reviewRepository.updateReviewStatus).toHaveBeenCalledWith("ORDER_002", true);
    expect(result).toEqual({ order, reviewOrder });
  });

  test("未邀请订单设置评价状态时，不应当更新状态", async () => {
    orderManageService.getOrder.mockResolvedValue([{ order_id: "ORDER_003", guest_name: "王五" }]);
    reviewRepository.getReviewByOrderId.mockResolvedValue(null);

    await expect(reviewService.updateReviewStatus("ORDER_003", false)).rejects.toMatchObject({
      statusCode: 400,
      message: "尚未邀请好评，无法设置好评状态"
    });
    expect(reviewRepository.updateReviewStatus).not.toHaveBeenCalled();
  });
});

describe("好评查询业务流程", () => {
  test("查询单笔订单好评信息时，应当保留多日订单数组响应", async () => {
    const orderRows = [{ order_id: "ORDER_004", stay_date: "2026-05-14" }];
    const review = { order_id: "ORDER_004", invited: true };
    orderManageService.getOrder.mockResolvedValue(orderRows);
    reviewRepository.getReviewByOrderId.mockResolvedValue(review);

    const result = await reviewService.getReviewByOrderId("ORDER_004");

    expect(result).toEqual({ order: orderRows, review });
  });

  test("查询列表和统计时，应当透传筛选条件", async () => {
    const filters = { startDate: "2026-05-01", endDate: "2026-05-14", status: "positive" };
    reviewRepository.getAllReviewOrders.mockResolvedValue([{ order_id: "ORDER_005" }]);
    reviewRepository.getReviewStatistics.mockResolvedValue({ total_invitations: "1" });

    await expect(reviewService.listAllReviews(filters)).resolves.toEqual([{ order_id: "ORDER_005" }]);
    await expect(reviewService.getReviewStatistics(filters)).resolves.toEqual({ total_invitations: "1" });
    expect(reviewRepository.getAllReviewOrders).toHaveBeenCalledWith(filters);
    expect(reviewRepository.getReviewStatistics).toHaveBeenCalledWith(filters);
  });
});
