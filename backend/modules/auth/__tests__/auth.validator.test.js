const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const {
  codeSchema,
  emailSchema,
  formatAjvErrors,
  loginSchema,
  resetPasswordSchema,
  signupSchema
} = require("../auth.validator");

function createAjv() {
  const ajv = new Ajv();
  addFormats(ajv);
  return ajv;
}

describe("员工注册参数校验", () => {
  test("姓名、邮箱和密码都填写时，应当通过参数校验", () => {
    const validate = createAjv().compile(signupSchema);

    expect(validate({
      name: "张三",
      email: "staff@example.com",
      pw: "password"
    })).toBe(true);
  });

  test("邮箱格式不正确时，应当拒绝注册", () => {
    const validate = createAjv().compile(signupSchema);

    const valid = validate({
      name: "张三",
      email: "bad-email",
      pw: "password"
    });

    expect(valid).toBe(false);
    expect(validate.errors[0].instancePath).toBe("/email");
  });

  test("多传无关字段时，应当拒绝注册", () => {
    const validate = createAjv().compile(signupSchema);

    expect(validate({
      name: "张三",
      email: "staff@example.com",
      pw: "password",
      role: "admin"
    })).toBe(false);
  });
});

describe("员工登录参数校验", () => {
  test("邮箱和密码都填写时，应当通过参数校验", () => {
    const validate = createAjv().compile(loginSchema);

    expect(validate({
      email: "staff@example.com",
      pw: "password"
    })).toBe(true);
  });

  test("没填密码时，应当拒绝登录", () => {
    const validate = createAjv().compile(loginSchema);

    const valid = validate({
      email: "staff@example.com"
    });

    expect(valid).toBe(false);
    expect(formatAjvErrors(validate.errors)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "pw" })
      ])
    );
  });
});

describe("邮箱和验证码参数校验", () => {
  test("发送邮件时，邮箱格式正确应当通过参数校验", () => {
    const validate = createAjv().compile(emailSchema);

    expect(validate({ email: "staff@example.com" })).toBe(true);
  });

  test("验证邮箱时，code 已填写应当通过参数校验", () => {
    const validate = createAjv().compile(codeSchema);

    expect(validate({ code: "abc" })).toBe(true);
  });

  test("重置密码时，密码和 code 都填写应当通过参数校验", () => {
    const validate = createAjv().compile(resetPasswordSchema);

    expect(validate({
      pw: "new-password",
      code: "abc"
    })).toBe(true);
  });
});
