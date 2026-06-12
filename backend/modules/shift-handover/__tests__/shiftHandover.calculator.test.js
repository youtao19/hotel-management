"use strict";

const calculator = require("../shiftHandover.calculator");

describe("shiftHandover.calculator", () => {
  test("按支付方式重算交接金额并保持两位小数", () => {
    const result = calculator.recalculatePaymentData({
      reserve: { "现金": 320, "微信": 0, "微邮付": 0, "其他": 0 },
      hotelIncome: { "现金": 100.1, "微信": 20.2, "微邮付": 0, "其他": 0 },
      restIncome: { "现金": 0.2, "微信": 0, "微邮付": 0, "其他": 0 },
      carRentIncome: {},
      hotelDeposit: { "现金": 50, "微信": 0, "微邮付": 0, "其他": 0 },
      restDeposit: {},
      retainedAmount: { "现金": 320, "微信": 0, "微邮付": 0, "其他": 0 }
    });

    expect(result.totalIncome["现金"]).toBe(420.3);
    expect(result.totalRefundDeposit["现金"]).toBe(50);
    expect(result.handoverAmount["现金"]).toBe(50.3);
    expect(result.hotelRefundDeposit).toEqual(result.hotelDeposit);
  });

  test("非法值归零", () => {
    expect(calculator.amountToCents(NaN)).toBe(0);
    expect(calculator.amountToCents(Infinity)).toBe(0);
    expect(calculator.amountToCents(undefined)).toBe(0);
    expect(calculator.amountToCents("abc")).toBe(0);
    expect(calculator.normalizeAmount(NaN)).toBe(0);
  });

  test("浮点精度：0.1 + 0.2 = 0.3", () => {
    expect(calculator.normalizeAmount(0.1 + 0.2)).toBe(0.3);
  });

  test("createPaymentBuckets 初始化四种支付方式为 0", () => {
    const buckets = calculator.createPaymentBuckets();
    expect(buckets).toEqual({ "现金": 0, "微信": 0, "微邮付": 0, "其他": 0 });
  });

  test("PAYMENT_METHODS 导出常量数组", () => {
    expect(calculator.PAYMENT_METHODS).toEqual(["现金", "微信", "微邮付", "其他"]);
  });

  test("convertBucketsToCents 和 convertBucketsToAmounts 互为逆运算", () => {
    const original = { "现金": 100.15, "微信": 50.05, "微邮付": 0, "其他": 0 };
    const cents = calculator.convertBucketsToCents(original);
    const back = calculator.convertBucketsToAmounts(cents);
    expect(back).toEqual({ "现金": 100.15, "微信": 50.05, "微邮付": 0, "其他": 0 });
  });

  test("normalizePaymentBucket 缺失键默认为 0", () => {
    const result = calculator.normalizePaymentBucket({});
    expect(result).toEqual({ "现金": 0, "微信": 0, "微邮付": 0, "其他": 0 });
  });

  test("recalculatePaymentData 用 overrides.reserve 替换 reserve", () => {
    const result = calculator.recalculatePaymentData(
      {
        reserve: { "现金": 0, "微信": 0, "微邮付": 0, "其他": 0 },
        hotelIncome: { "现金": 100, "微信": 0, "微邮付": 0, "其他": 0 },
        restIncome: {},
        hotelDeposit: {},
        restDeposit: {},
        retainedAmount: {}
      },
      { reserve: { "现金": 320, "微信": 0, "微邮付": 0, "其他": 0 } }
    );
    expect(result.reserve["现金"]).toBe(320);
    expect(result.totalIncome["现金"]).toBe(420);
  });
});
