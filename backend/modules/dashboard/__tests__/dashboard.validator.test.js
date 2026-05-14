const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const {
  memoCreateSchema,
  memoUpdateSchema,
  normalizeMemoDate,
  normalizeMemoId,
  normalizeMemoPayload
} = require("../dashboard.validator");

function createAjv() {
  const ajv = new Ajv();
  addFormats(ajv);
  return ajv;
}

describe("仪表盘备忘录参数校验", () => {
  test("新增备忘录信息完整时，应当通过参数校验", () => {
    const validate = createAjv().compile(memoCreateSchema);

    expect(validate({
      memo_date: "2026-05-15",
      title: "联系客人",
      priority: "medium",
      completed: false
    })).toBe(true);
  });

  test("新增备忘录没填日期时，应当拒绝创建", () => {
    const validate = createAjv().compile(memoCreateSchema);
    const valid = validate({ title: "联系客人" });

    expect(valid).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ params: { missingProperty: "memo_date" } })])
    );
  });

  test("新增备忘录日期不是 YYYY-MM-DD 时，应当拒绝创建", () => {
    const validate = createAjv().compile(memoCreateSchema);

    expect(validate({ memo_date: "2026/05/15", title: "联系客人" })).toBe(false);
  });

  test("更新备忘录至少要传一个可更新字段", () => {
    const validate = createAjv().compile(memoUpdateSchema);

    expect(validate({})).toBe(false);
  });

  test("标题会先去掉前后空格，再进入业务层", () => {
    expect(normalizeMemoPayload({ title: "  联系客人  " })).toEqual({ title: "联系客人" });
  });

  test("DATE 字段只归一成 YYYY-MM-DD 字符串", () => {
    expect(normalizeMemoDate("2026-05-15T12:30:00Z")).toBe("2026-05-15");
  });

  test("备忘录 ID 不是数字时，应当识别为无效", () => {
    expect(normalizeMemoId("abc")).toBeNull();
    expect(normalizeMemoId("12")).toBe(12);
  });
});
