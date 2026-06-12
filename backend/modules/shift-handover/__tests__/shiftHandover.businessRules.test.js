"use strict";

const rules = require("../shiftHandover.businessRules");

describe("shiftHandover.businessRules", () => {
  describe("getPreviousBusinessDate", () => {
    test.each([
      ["2026-01-01", "2025-12-31"],
      ["2026-03-01", "2026-02-28"],
      ["2024-03-01", "2024-02-29"],
      ["2026-06-12", "2026-06-11"],
    ])("前一天日期保持 YYYY-MM-DD 字符串: %s → %s", (date, expected) => {
      expect(rules.getPreviousBusinessDate(date)).toBe(expected);
    });
  });

  describe("resolveCurrentShift", () => {
    test.each([
      [new Date(2026, 5, 12, 7, 59), "night"],
      [new Date(2026, 5, 12, 8, 0), "morning"],
      [new Date(2026, 5, 12, 15, 59), "morning"],
      [new Date(2026, 5, 12, 16, 0), "evening"],
      [new Date(2026, 5, 12, 23, 59), "evening"],
      [new Date(2026, 5, 12, 0, 0), "night"],
    ])("按本地时间判断班次: %s → %s", (now, expectedCode) => {
      expect(rules.resolveCurrentShift(now).code).toBe(expectedCode);
    });

    test("返回对象包含 code, label, timeRange", () => {
      const shift = rules.resolveCurrentShift(new Date(2026, 5, 12, 10, 0));
      expect(shift).toEqual({
        code: expect.any(String),
        label: expect.any(String),
        timeRange: expect.any(String),
      });
    });
  });

  describe("resolveCurrentUser", () => {
    test("从 account 中提取用户信息", () => {
      const user = rules.resolveCurrentUser({
        id: 1,
        username: "peach",
        role: "admin",
      });
      expect(user).toEqual({
        id: 1,
        name: "peach",
        role: "admin",
      });
    });

    test("缺省字段使用默认值", () => {
      const user = rules.resolveCurrentUser({});
      expect(user).toEqual({
        id: null,
        name: "当前用户",
        role: "前台",
      });
    });
  });

  describe("buildReserveDefaults", () => {
    test("完整交接时现金 320，微信取昨日交接款", () => {
      const defaults = rules.buildReserveDefaults({
        isComplete: true,
        handoverAmounts: {
          "现金": 100,
          "微信": 200,
          "微邮付": 300,
          "其他": 400,
        },
      });
      expect(defaults).toEqual({
        "现金": 320,
        "微信": 200,
        "微邮付": 0,
        "其他": 0,
      });
    });

    test("不完整交接时除现金外全部为 0", () => {
      const defaults = rules.buildReserveDefaults({
        isComplete: false,
        handoverAmounts: {
          "现金": 0,
          "微信": 0,
          "微邮付": 0,
          "其他": 0,
        },
      });
      expect(defaults).toEqual({
        "现金": 320,
        "微信": 0,
        "微邮付": 0,
        "其他": 0,
      });
    });
  });
});
