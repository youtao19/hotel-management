import Decimal from "decimal.js";

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
});

export function useDecimalUtils() {
  const PAY_WAY_KEYS = ["现金", "微信", "微邮付", "其他"];

  const toDecimal = (value) => {
    if (Decimal.isDecimal(value)) return value;
    if (value === undefined || value === null) return new Decimal(0);
    if (typeof value === "string") {
      const parsed = Number(value.trim());
      return Number.isNaN(parsed) ? new Decimal(0) : new Decimal(parsed);
    }
    if (typeof value === "number") {
      return Number.isNaN(value) ? new Decimal(0) : new Decimal(value);
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? new Decimal(0) : new Decimal(parsed);
  };

  const toAmountNumber = (value, places = 2) =>
    Number(toDecimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toString());

  const sumDecimals = (...values) =>
    values.reduce((acc, val) => acc.plus(toDecimal(val)), new Decimal(0));

  const createPaywayBucket = (seed = {}) => {
    const bucket = {};
    PAY_WAY_KEYS.forEach((key) => {
      const source = Object.prototype.hasOwnProperty.call(seed, key) ? seed[key] : 0;
      bucket[key] = toAmountNumber(source);
    });
    return bucket;
  };

  return {
    PAY_WAY_KEYS,
    toDecimal,
    toAmountNumber,
    sumDecimals,
    createPaywayBucket
  };
}
