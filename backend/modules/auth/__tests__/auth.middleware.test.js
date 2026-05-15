const {
  authenticationMiddleware,
  ensureAuthenticated
} = require("../auth.middleware");

function createSession() {
  return {
    regenerate: jest.fn((callback) => callback(null)),
    save: jest.fn((callback) => callback(null)),
    destroy: jest.fn((callback) => callback(null))
  };
}

function createRes() {
  return {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis()
  };
}

describe("员工登录态中间件", () => {
  test("初始化请求时，应当挂载登录、登出和登录态判断方法", () => {
    const req = {};
    const next = jest.fn();

    authenticationMiddleware(req, {}, next);

    expect(typeof req.login).toBe("function");
    expect(typeof req.logout).toBe("function");
    expect(typeof req.isAuthenticated).toBe("function");
    expect(next).toHaveBeenCalled();
  });

  test("登录成功时，应当重建 session 并保存账号信息", async () => {
    const req = { session: createSession() };
    authenticationMiddleware(req, {}, jest.fn());

    await req.login({ account: { id: 1, name: "张三" } });

    expect(req.session.regenerate).toHaveBeenCalled();
    expect(req.session.account).toEqual({ id: 1, name: "张三" });
    expect(req.session.authenticated).toBe(true);
    expect(req.session.save).toHaveBeenCalled();
  });

  test("未登录访问受保护接口时，应当继续返回 401", () => {
    const req = {
      isAuthenticated: () => false
    };
    const res = createRes();
    const next = jest.fn();

    ensureAuthenticated(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
  });
});
