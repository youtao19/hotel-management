const {
  authenticationMiddleware,
  ensureAuthenticated,
  resolveAccountFromRequest
} = require("../auth.middleware");

function createRes() {
  return {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis()
  };
}

describe("员工登录态中间件", () => {
  test("合法 Bearer token 时，authenticationMiddleware 应当把账号写入 req.account", () => {
    // 直接 mock helper 模块，避免依赖真实密钥签名
    jest.resetModules();
    jest.doMock("../jwt.helper", () => ({
      verifyAccountToken: jest.fn(() => ({ id: 1, name: "张三", email: "a@b.com" }))
    }));
    const middleware = require("../auth.middleware");

    const req = { headers: { authorization: "Bearer valid.token.here" } };
    const next = jest.fn();

    middleware.authenticationMiddleware(req, createRes(), next);

    expect(req.account).toEqual({ id: 1, name: "张三", email: "a@b.com" });
    expect(next).toHaveBeenCalled();
  });

  test("无 Authorization 头时，resolveAccountFromRequest 返回 missing 且不写 req.account", () => {
    const result = resolveAccountFromRequest({ headers: {} });
    expect(result).toEqual({ ok: false, reason: "missing" });

    const req = { headers: {} };
    authenticationMiddleware(req, createRes(), jest.fn());
    expect(req.account).toBeUndefined();
  });

  test("Authorization 不是 Bearer 前缀时返回 format", () => {
    const result = resolveAccountFromRequest({ headers: { authorization: "Token abc" } });
    expect(result).toEqual({ ok: false, reason: "format" });
  });

  test("Bearer 后 token 为空时返回 empty", () => {
    const result = resolveAccountFromRequest({ headers: { authorization: "Bearer " } });
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  test("token 校验失败时返回 invalid", () => {
    jest.resetModules();
    jest.doMock("../jwt.helper", () => ({
      verifyAccountToken: jest.fn(() => { throw new Error("jwt malformed"); })
    }));
    const { resolveAccountFromRequest: resolve } = require("../auth.middleware");
    const result = resolve({ headers: { authorization: "Bearer not.a.jwt" } });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  test("未登录访问受保护接口时，应当返回 401", () => {
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    ensureAuthenticated(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "未登录" });
  });

  test("已登录访问受保护接口时，应当放行", () => {
    const req = { account: { id: 1, name: "张三", email: "a@b.com" } };
    const res = createRes();
    const next = jest.fn();

    ensureAuthenticated(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
