const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const {
  formatAjvErrors,
  positiveReviewSchema
} = require("../review.validator");

function createAjv() {
  const ajv = new Ajv();
  addFormats(ajv);
  return ajv;
}

describe("好评状态参数校验", () => {
  test("用户设置好评时，应当通过参数校验", () => {
    const validate = createAjv().compile(positiveReviewSchema);

    expect(validate({ positive_review: true })).toBe(true);
  });

  test("用户设置未好评时，应当通过参数校验", () => {
    const validate = createAjv().compile(positiveReviewSchema);

    expect(validate({ positive_review: false })).toBe(true);
  });

  test("用户没传 positive_review 时，应当拒绝请求", () => {
    const validate = createAjv().compile(positiveReviewSchema);

    const valid = validate({});

    expect(valid).toBe(false);
    expect(formatAjvErrors(validate.errors)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "positive_review" })
      ])
    );
  });

  test("用户多传无关字段时，应当拒绝请求", () => {
    const validate = createAjv().compile(positiveReviewSchema);

    expect(validate({ positive_review: true, note: "额外字段" })).toBe(false);
  });
});
