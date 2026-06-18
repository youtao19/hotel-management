const request = require("supertest");
const app = require("../app");
const { query } = require("../database/postgreDB/pg");
const { authedRequest, authHeader, addRoomType, addRoom, createOrder, buildOrderPayload } = require("./tools");

const TEST_ROOM_TYPE = {
  type_code: "REVIEW_TEST_TYPE",
  type_name: "评价测试房型",
  base_price: 188.0,
  description: "用于评价路由测试的房型",
  is_closed: false
};

const TEST_ROOM = {
  room_number: "REVIEW_TEST_ROOM_01",
  type_code: TEST_ROOM_TYPE.type_code,
  status: "available",
  price: 188.0,
  is_closed: false
};

const ORDER_PREFIX = "REVIEW_TEST_ORDER_"; // 订单ID前缀，便于测试数据清理

const createTestOrder = async (overrides = {}) => {
  const orderId = overrides.order_id || `${ORDER_PREFIX}${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const payload = buildOrderPayload({
    orderId,
    roomType: TEST_ROOM_TYPE.type_code,
    roomNumber: TEST_ROOM.room_number,
    checkInDate: "2025-01-01",
    checkOutDate: "2025-01-02",
    paymentMethod: "测试支付",
    roomPrice: {
      "2025-01-01": 188.0
    },
    deposit: 100.0,
    stayType: "客房",
    guestName: "评价测试住客",
    orderSource: "评价路由测试",
    ...overrides,
    order_id: orderId
  });
  await createOrder(payload);
  return payload;
};

beforeAll(async () => {
  await query("DELETE FROM review_invitations WHERE order_id LIKE $1", [`${ORDER_PREFIX}%`]);
  await query("DELETE FROM orders WHERE order_id LIKE $1", [`${ORDER_PREFIX}%`]);
  await query("DELETE FROM rooms WHERE room_number = $1", [TEST_ROOM.room_number]);
  await query("DELETE FROM room_types WHERE type_code = $1", [TEST_ROOM_TYPE.type_code]);

  await addRoomType([TEST_ROOM_TYPE]);
  await addRoom([TEST_ROOM]);
});

afterEach(async () => {
  await query("DELETE FROM review_invitations WHERE order_id LIKE $1", [`${ORDER_PREFIX}%`]);
  await query("DELETE FROM orders WHERE order_id LIKE $1", [`${ORDER_PREFIX}%`]);
});

describe("POST /api/reviews/:orderId/invite", () => {
  test("成功邀请已有订单", async () => {
    const order = await createTestOrder();

    const guestName = order.guestName || order.guest_name;

    const response = await authedRequest()
      .post(`/api/reviews/${order.order_id}/invite`)
      .send();

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe(`已成功邀请客户 ${guestName} 参与好评`);
    expect(response.body.order).toMatchObject({
      order_id: order.order_id,
      review_invited: true
    });

    const stored = await query(
      "SELECT invited, positive_review FROM review_invitations WHERE order_id = $1",
      [order.order_id]
    );

    expect(stored.rows.length).toBe(1);
    expect(stored.rows[0].invited).toBe(true);
    expect(stored.rows[0].positive_review).toBeNull();
  });

  test("订单不存在返回 404", async () => {
    const response = await authedRequest()
      .post("/api/reviews/NON_EXIST_ORDER/invite")
      .send();

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("订单不存在");
  });
});

describe("PUT /api/reviews/:orderId/status", () => {
  test("设置好评状态成功", async () => {
    const order = await createTestOrder();

    const guestName = order.guestName || order.guest_name;

    const inviteResponse = await authedRequest()
      .post(`/api/reviews/${order.order_id}/invite`)
      .send();

    expect(inviteResponse.statusCode).toBe(200);

    const response = await authedRequest()
      .put(`/api/reviews/${order.order_id}/status`)
      .send({ positive_review: true });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe(`已将客户 ${guestName} 的评价设置为好评`);
    expect(response.body.order).toMatchObject({
      order_id: order.order_id,
      positive_review: true
    });

    const stored = await query(
      "SELECT invited, positive_review FROM review_invitations WHERE order_id = $1",
      [order.order_id]
    );

    expect(stored.rows.length).toBe(1);
    expect(stored.rows[0].invited).toBe(true);
    expect(stored.rows[0].positive_review).toBe(true);
  });

  test("缺少 positive_review 字段返回 400", async () => {
    const order = await createTestOrder();

    const response = await authedRequest()
      .put(`/api/reviews/${order.order_id}/status`)
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("请求数据验证失败");
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "positive_review"
        })
      ])
    );
  });

  test("未邀请订单无法设置好评状态", async () => {
    const order = await createTestOrder();

    const response = await authedRequest()
      .put(`/api/reviews/${order.order_id}/status`)
      .send({ positive_review: false });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("尚未邀请好评，无法设置好评状态");
  });
});
