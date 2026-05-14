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

const authService = require("../auth.service");
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

  test("登录被限流时，应当保留 Retry-After 和旧响应文本", async () => {
    const req = {
      body: {
        email: "staff@example.com",
        pw: "password"
      },
      ip: "127.0.0.1",
      login: jest.fn()
    };
    const res = createRes();
    authService.login.mockResolvedValue({
      status: 429,
      retryAfter: 60,
      text: "Too Many Requests"
    });

    await controller.login(req, res);

    expect(authService.login).toHaveBeenCalledWith({
      email: "staff@example.com",
      pw: "password",
      ipAddr: "127.0.0.1",
      login: expect.any(Function)
    });
    expect(res.set).toHaveBeenCalledWith("Retry-After", "60");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.send).toHaveBeenCalledWith("Too Many Requests");
  });

  test("获取当前用户时，session 没有账号应当继续返回未登录", async () => {
    const req = {
      session: {}
    };
    const res = createRes();

    await controller.getCurrentUser(req, res);

    expect(authService.getCurrentUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "未登录" });
  });

  test("登出时即使 session 不存在，也应当清理 cookie", async () => {
    const req = {};
    const res = createRes();

    await controller.logout(req, res);

    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "登出成功" });
  });
});
