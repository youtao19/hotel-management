"use strict";

const validator = require("../shiftHandover.validator");

describe("交接班参数校验", () => {
  test("查询日期前后有空格时，应当清理后继续使用原来的 YYYY-MM-DD 字符串", () => {
    const parsed = validator.readDateQuery({ date: " 2025-11-02 " });

    expect(parsed.error).toBeUndefined();
    expect(parsed.value).toEqual({ date: "2025-11-02" });
  });

  test("查询日期没传时，应当返回原接口使用的错误格式", () => {
    const parsed = validator.readDateQuery({});

    expect(parsed.error.status).toBe(400);
    expect(parsed.error.body).toEqual(expect.objectContaining({
      success: false,
      message: "缺少必需的日期参数",
      errors: expect.any(Array)
    }));
  });

  test("完成交接班只填必需字段时，应当通过校验", () => {
    const body = {
      date: "2025-11-02",
      receivePerson: "peach"
    };
    const parsed = validator.readCompleteHandoverBody(body);

    expect(parsed.error).toBeUndefined();
    expect(parsed.value).toBe(body);
  });

  test("留存金额缺少支付方式时，应当拒绝完成交接班", () => {
    const parsed = validator.readCompleteHandoverBody({
      date: "2025-11-02",
      receivePerson: "peach",
      retainedAmount: {
        "现金": 320,
        "微信": 0,
        "微邮付": 0
      }
    });

    expect(parsed.error.status).toBe(400);
    expect(parsed.error.body.message).toBe("请求数据格式错误");
  });
});
