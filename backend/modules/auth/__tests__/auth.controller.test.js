jest.mock("../auth.service", () => ({
  checkEmail: jest.fn(),
  checkResetCode: jest.fn(),
  getCurrentUser: jest.fn(),
  getCurrentUserEmailVerified: jest.fn(),
  login: jest.fn(),
  resetPassword: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendResetPasswordEmail: jest.fn(),
  signup: jest.fn(),
  verifyEmail: jest.fn()
}));

jest.mock("../jwt.helper", () => ({
  signAccountToken: jest.fn(() => "jwt-token")
}));

const authService = require("../auth.service");
const { signAccountToken } = require("../jwt.helper");
const controller = require("../auth.controller");

function createRes() {
  return {
    clearCookie: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis()
  };
}

describe("员工认证接口控制器", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("注册参数合法时，应当返回原来的账号字段", async () => {
    const req = {
      body: {
        name: "张三",
        email: "staff@example.com",
        pw: "password"
      }
    };
    const res = createRes();
    authService.signup.mockResolvedValue({
      id: 1,
      name: "张三",
      email: "staff@example.com"
    });

    await controller.signup(req, res);

    expect(authService.signup).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      id: 1,
      name: "张三",
      email: "staff@example.com"
    });
  });

  test("登录成功时，应当在响应体追加 token", async () => {
    const req = {
      body: { email: "staff@example.com", pw: "password" },
      ip: "127.0.0.1"
    };
    const res = createRes();
    authService.login.mockResolvedValue({
      status: 200,
      body: { id: 1, name: "张三", email: "staff@example.com" }
    });

    await controller.login(req, res);

    // 登录服务不再接收 login 回调
    expect(authService.login).toHaveBeenCalledWith({
      email: "staff@example.com",
      pw: "password",
      ipAddr: "127.0.0.1"
    });
    expect(signAccountToken).toHaveBeenCalledWith({ id: 1, name: "张三", email: "staff@example.com" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      id: 1,
      name: "张三",
      email: "staff@example.com",
      token: "jwt-token"
    });
  });

  test("登录被限流时，应当保留 Retry-After 和旧响应文本，且不签发 token", async () => {
    const req = {
      body: {
        email: "staff@example.com",
        pw: "password"
      },
      ip: "127.0.0.1"
    };
    const res = createRes();
    authService.login.mockResolvedValue({
      status: 429,
      retryAfter: 60,
      text: "Too Many Requests"
    });

    await controller.login(req, res);

    expect(res.set).toHaveBeenCalledWith("Retry-After", "60");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.send).toHaveBeenCalledWith("Too Many Requests");
    expect(signAccountToken).not.toHaveBeenCalled();
  });

  test("获取当前用户时，req.account 缺失应当返回未登录", async () => {
    const req = {};
    const res = createRes();

    await controller.getCurrentUser(req, res);

    expect(authService.getCurrentUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "未登录" });
  });

  test("登出接口应当直接返回成功，不再操作 session/cookie", async () => {
    const req = {};
    const res = createRes();

    await controller.logout(req, res);

    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "登出成功" });
  });
});
