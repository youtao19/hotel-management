const request = require("supertest");
const app = require("../../app");
const { query } = require("../../database/postgreDB/pg");
const { addRoomType, addRoom } = require("../tools");

function logActiveHandles(label) {
  const handles = process._getActiveHandles();
  const requests = process._getActiveRequests();
  console.log(`[DEBUG][${label}] active handles count`, handles.length);
  handles.forEach((handle, index) => {
    const ctor = handle && handle.constructor ? handle.constructor.name : "unknown";
    const extra =
      ctor === "Socket"
        ? {
            local: `${handle.localAddress || "unknown"}:${handle.localPort || 0}`,
            remote: `${handle.remoteAddress || "unknown"}:${handle.remotePort || 0}`,
            destroyed: handle.destroyed,
          }
        : undefined;
    console.log(`[DEBUG][${label}] handle[${index}]`, ctor, extra || "");
  });
  console.log(`[DEBUG][${label}] active requests count`, requests.length);
  requests.forEach((req, index) => {
    const ctor = req && req.constructor ? req.constructor.name : "unknown";
    console.log(`[DEBUG][${label}] request[${index}]`, ctor);
  });
}

describe("交接班流程集成测试", () => {
  const CHECK_DATE = "2025-01-01"; // 步骤一检查的日期
  const HANDOVER_DATE = "2025-01-02"; // 步骤六保存的交接日期

  const TEST_ROOM_TYPES = [
    {
      type_code: "HANDOVER_GUEST",
      type_name: "交接班客房",
      base_price: 260.0,
      description: "交接班测试客房",
      is_closed: false
    },
    {
      type_code: "HANDOVER_REST",
      type_name: "交接班休息房",
      base_price: 180.0,
      description: "交接班测试休息房",
      is_closed: false
    }
  ];

  const TEST_ROOMS = [
    {
      room_number: "HOGUEST01",
      type_code: "HANDOVER_GUEST",
      status: "available",
      price: 260.0,
      is_closed: false
    },
    {
      room_number: "HO-REST-01",
      type_code: "HANDOVER_REST",
      status: "available",
      price: 180.0,
      is_closed: false
    }
  ];

  const GUEST_ORDER_ID = "HANDOVER_ORDER_GUEST";
  const REST_ORDER_ID = "HANDOVER_ORDER_REST";

  const HANDOVER_AMOUNTS = {
    cash: 320,
    wechat: 150,
    weyoufu: 80,
    other: 30
  };

  beforeAll(async () => {
    await addRoomType(TEST_ROOM_TYPES);
    await addRoom(TEST_ROOMS);

    // 创建订单数据
    await query(
      `INSERT INTO orders (
        order_id, id_source, order_source, guest_name, room_type, room_number,
        check_in_date, check_out_date, status, payment_method, phone, total_price,
        deposit, stay_type, create_time, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7::date, $8::date, $9, $10, $11, $12,
        $13, $14, $15::timestamp, $16
      )`,
      [
        GUEST_ORDER_ID,
        "web",
        "渠道",
        "交接班客房客人",
        TEST_ROOM_TYPES[0].type_code,
        TEST_ROOMS[0].room_number,
        HANDOVER_DATE,
        "2025-01-03",
        "checked-in",
        "现金",
        "13800000000",
        520.0,
        100.0,
        "客房",
        "2025-01-01T09:00:00Z",
        "交接班客房测试订单"
      ]
    );

    await query(
      `INSERT INTO orders (
        order_id, id_source, order_source, guest_name, room_type, room_number,
        check_in_date, check_out_date, status, payment_method, phone, total_price,
        deposit, stay_type, create_time, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7::date, $8::date, $9, $10, $11, $12,
        $13, $14, $15::timestamp, $16
      )`,
      [
        REST_ORDER_ID,
        "frontdesk",
        "现场",
        "交接班休息客人",
        TEST_ROOM_TYPES[1].type_code,
        TEST_ROOMS[1].room_number,
        HANDOVER_DATE,
        HANDOVER_DATE,
        "checked-in",
        "微信",
        "13900000000",
        180.0,
        0,
        "休息房",
        "2025-01-01T11:30:00Z",
        "交接班休息房测试订单"
      ]
    );

    // 创建好评邀请数据
    await query(
      `INSERT INTO review_invitations (
        order_id, invited, positive_review, invite_time, update_time
      ) VALUES (
        $1, $2, $3, $4::timestamp, $5::timestamp
      )`,
      [
        GUEST_ORDER_ID,
        true,
        true,
        `${HANDOVER_DATE}T10:00:00Z`,
        `${HANDOVER_DATE}T12:00:00Z`
      ]
    );

    // 创建账单数据（步骤三使用）
    await query(
      `INSERT INTO bills (
        order_id, room_number, guest_name, change_price, change_type, pay_way,
        create_time, remarks, stay_type, stay_date
      ) VALUES
        ($1, $2, $3, $4, $5, $6, $7::timestamp, $8, $9, $10::date),
        ($1, $2, $3, $11, $12, $13, $14::timestamp, $15, $16, $17::date),
        ($18, $19, $20, $21, $22, $23, $24::timestamp, $25, $26, $27::date)
      `,
      [
        GUEST_ORDER_ID,
        TEST_ROOMS[0].room_number,
        "交接班客房客人",
        300,
        "房费",
        "现金",
        `${HANDOVER_DATE}T10:00:00Z`,
        "客房收入",
        "客房",
        HANDOVER_DATE,
        -50,
        "退押",
        "微信",
        `${HANDOVER_DATE}T11:00:00Z`,
        "客房退押",
        "客房",
        HANDOVER_DATE,
        REST_ORDER_ID,
        TEST_ROOMS[1].room_number,
        "交接班休息客人",
        120,
        "房费",
        "微信",
        `${HANDOVER_DATE}T12:30:00Z`,
        "休息房收入",
        "休息房",
        HANDOVER_DATE
      ]
    );

    // 创建步骤一需要的交接记录（检查昨日交接记录）
    const paymentTypes = [
      { type: 1, field: "cash" },
      { type: 2, field: "wechat" },
      { type: 3, field: "weyoufu" },
      { type: 4, field: "other" }
    ];

    for (const { type, field } of paymentTypes) {
      await query(
        `INSERT INTO handover (
          date, handover_person, takeover_person, vip_card, payment_type,
          reserve_cash, room_income, rest_income, rent_income, total_income,
          room_refund, rest_refund, retained, handover, task_list, remarks
        ) VALUES (
          $1::date, $2, $3, $4, $5,
          $6, 0, 0, 0, $7,
          0, 0, 0, $8, $9, $10
        )`,
        [
          CHECK_DATE,
          "昨日交班人",
          "昨日接班人",
          type === 1 ? 3 : 0,
          type,
          0,
          HANDOVER_AMOUNTS[field],
          HANDOVER_AMOUNTS[field],
          JSON.stringify([]),
          "昨日交接记录"
        ]
      );
    }
  });

  afterAll(async () => {
    logActiveHandles("before cleanup");
    await query("DELETE FROM handover WHERE date = $1::date", [CHECK_DATE]);
    await query("DELETE FROM handover WHERE date = $1::date", [HANDOVER_DATE]);
    await query("DELETE FROM review_invitations WHERE order_id IN ($1, $2)", [
      GUEST_ORDER_ID,
      REST_ORDER_ID
    ]);
    await query("DELETE FROM bills WHERE order_id IN ($1, $2)", [
      GUEST_ORDER_ID,
      REST_ORDER_ID
    ]);
    await query("DELETE FROM orders WHERE order_id IN ($1, $2)", [
      GUEST_ORDER_ID,
      REST_ORDER_ID
    ]);
    await query("DELETE FROM rooms WHERE room_number IN ($1, $2)", [
      TEST_ROOMS[0].room_number,
      TEST_ROOMS[1].room_number
    ]);
    await query("DELETE FROM room_types WHERE type_code IN ($1, $2)", [
      TEST_ROOM_TYPES[0].type_code,
      TEST_ROOM_TYPES[1].type_code
    ]);
    logActiveHandles("after cleanup");
  });

  test("应当完成交接班步骤一到六", async () => {
    // 步骤一：检查昨日交接记录
    const step1Response = await request(app)
      .get("/api/handover/check-yesterday")
      .query({ date: CHECK_DATE });

    expect(step1Response.statusCode).toBe(200);
    expect(step1Response.body.success).toBe(true);
    expect(step1Response.body.data.isComplete).toBe(true);
    expect(step1Response.body.data.paymentCount).toBe(4);

    const { handoverAmounts } = step1Response.body.data;
    expect(handoverAmounts.cash).toBe(HANDOVER_AMOUNTS.cash);
    expect(handoverAmounts.wechat).toBe(HANDOVER_AMOUNTS.wechat);
    expect(handoverAmounts.weyoufu).toBe(HANDOVER_AMOUNTS.weyoufu);
    expect(handoverAmounts.other).toBe(HANDOVER_AMOUNTS.other);

    const reserveTotal =
      handoverAmounts.cash +
      handoverAmounts.wechat +
      handoverAmounts.weyoufu +
      handoverAmounts.other;
    expect(reserveTotal).toBe(580);

    // 步骤三：加载账单数据
    const step3Response = await request(app).get(
      `/api/bills/by-date/${HANDOVER_DATE}`
    );

    expect(step3Response.statusCode).toBe(200);
    expect(step3Response.body.success).toBe(true);
    expect(step3Response.body.data.totalCount).toBe(3);
    expect(step3Response.body.data.hotelBills.length).toBe(2);
    expect(step3Response.body.data.restBills.length).toBe(1);

    // 步骤四：获取特殊统计
    const step4Response = await request(app)
      .get("/api/handover/special-stats")
      .query({ date: HANDOVER_DATE });

    expect(step4Response.statusCode).toBe(200);
    expect(step4Response.body.success).toBe(true);
    expect(step4Response.body.data.openCount).toBe(1);
    expect(step4Response.body.data.restCount).toBe(1);
    expect(step4Response.body.data.invited).toBe(1);
    expect(step4Response.body.data.positive).toBe(1);

    // 步骤六：完成交接（步骤二与步骤五为前端处理，直接构造最终请求数据）
    const paymentData = {
      reserve: {
        现金: HANDOVER_AMOUNTS.cash,
        微信: HANDOVER_AMOUNTS.wechat,
        微邮付: HANDOVER_AMOUNTS.weyoufu,
        其他: HANDOVER_AMOUNTS.other
      },
      hotelIncome: {
        现金: 300,
        微信: 0,
        微邮付: 0,
        其他: 0
      },
      restIncome: {
        现金: 0,
        微信: 120,
        微邮付: 0,
        其他: 0
      },
      carRentIncome: {
        现金: 0,
        微信: 0,
        微邮付: 0,
        其他: 0
      },
      totalIncome: {
        现金: 620,
        微信: 270,
        微邮付: 0,
        其他: 30
      },
      hotelDeposit: {
        现金: 0,
        微信: 50,
        微邮付: 0,
        其他: 0
      },
      restDeposit: {
        现金: 0,
        微信: 0,
        微邮付: 0,
        其他: 0
      },
      totalRefundDeposit: {
        现金: 0,
        微信: 50,
        微邮付: 0,
        其他: 0
      },
      retainedAmount: {
        现金: 320,
        微信: 0,
        微邮付: 0,
        其他: 0
      },
      handoverAmount: {
        现金: 300,
        微信: 220,
        微邮付: 0,
        其他: 30
      }
    };

    const completeResponse = await request(app)
      .post("/api/handover/complete")
      .send({
        date: HANDOVER_DATE,
        handoverPerson: "测试交班人",
        receivePerson: "测试接班人",
        paymentData,
        vipCard: 5,
        taskList: ["巡检前台备用金", "确认订房记录"],
        notes: "夜班交接完成"
      });

    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.body.success).toBe(true);
    expect(completeResponse.body.data.recordCount).toBe(4);

    // 验证数据库中保存的交接班记录
    const stored = await query(
      `SELECT
        date::text AS date,
        payment_type,
        handover,
        reserve_cash,
        room_income,
        rest_income,
        total_income,
        room_refund,
        rest_refund,
        retained,
        takeover_person,
        handover_person,
        vip_card,
        remarks
      FROM handover
      WHERE date = $1::date
      ORDER BY payment_type ASC`,
      [HANDOVER_DATE]
    );

    expect(stored.rows.length).toBe(4);

    const paymentTypeMap = {
      1: "现金",
      2: "微信",
      3: "微邮付",
      4: "其他"
    };

    stored.rows.forEach((row) => {
      const method = paymentTypeMap[row.payment_type];
      expect(row.handover_person).toBe("测试交班人");
      expect(row.takeover_person).toBe("测试接班人");

      if (method === "现金") {
        expect(Number(row.vip_card)).toBe(5);
        expect(row.remarks).toBe("夜班交接完成");
      }

      expect(Number(row.handover)).toBe(paymentData.handoverAmount[method]);
      expect(Number(row.reserve_cash)).toBe(paymentData.reserve[method]);
      expect(Number(row.room_income)).toBe(paymentData.hotelIncome[method]);
      expect(Number(row.rest_income)).toBe(paymentData.restIncome[method]);
      expect(Number(row.total_income)).toBe(paymentData.totalIncome[method]);
      expect(Number(row.room_refund)).toBe(paymentData.hotelDeposit[method]);
      expect(Number(row.rest_refund)).toBe(paymentData.restDeposit[method]);
      expect(Number(row.retained)).toBe(paymentData.retainedAmount[method]);
    });

    // 验证交接班表格接口可以读取刚保存的数据
    const tableResponse = await request(app)
      .get("/api/handover/handover-table")
      .query({ date: HANDOVER_DATE });

    expect(tableResponse.statusCode).toBe(200);
    expect(tableResponse.body.success).toBe(true);
    expect(tableResponse.body.data.handoverAmount["现金"]).toBe(300);
    expect(tableResponse.body.data.handoverAmount["微信"]).toBe(220);
    expect(tableResponse.body.data.vipCards).toBe(5);
  });
});
