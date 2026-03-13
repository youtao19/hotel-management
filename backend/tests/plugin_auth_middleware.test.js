"use strict";

const { pluginAuth, buildPluginSignature } = require("../routes/plugin/plugin-auth.middleware");

// 测试用插件 key。
const TEST_PLUGIN_KEY = "plugin-test-key";
// 测试用插件 secret。
const TEST_PLUGIN_SECRET = "plugin-test-secret";

/**
 * 构造签名请求头。
 * @param {object} options 头部构造参数
 * @param {string} options.method HTTP 方法
 * @param {string} options.path 请求路径
 * @param {string} options.rawBody 原始请求体
 * @param {string} options.timestamp 时间戳字符串
 * @param {string} options.nonce 单次随机串
 * @returns {object} 请求头对象
 */
function buildSignedHeaders({ method, path, rawBody, timestamp, nonce }) {
  // 计算动态签名。
  const signature = buildPluginSignature(
    TEST_PLUGIN_SECRET,
    method,
    path,
    timestamp,
    nonce,
    rawBody
  );

  return {
    "x-plugin-key": TEST_PLUGIN_KEY,
    "x-plugin-timestamp": timestamp,
    "x-plugin-nonce": nonce,
    "x-plugin-signature": signature
  };
}

/**
 * 构造中间件测试用 req/res。
 * @param {object} options 测试输入参数
 * @param {string} options.method HTTP 方法
 * @param {string} options.path 请求路径
 * @param {string} options.rawBody 原始请求体
 * @param {object} options.headers 请求头
 * @returns {object} req/res 对象
 */
function buildReqRes({ method, path, rawBody, headers }) {
  // 标准化请求头，确保 get 查询不区分大小写。
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => [String(key).toLowerCase(), value])
  );

  // 模拟 Express req 对象。
  const req = {
    method: method || "POST",
    originalUrl: path || "/api/plugin/orders",
    rawBody: rawBody || "",
    get(name) {
      return normalizedHeaders[String(name).toLowerCase()];
    }
  };

  // 模拟 Express res 对象。
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };

  return { req, res };
}

describe("pluginAuth 动态签名鉴权中间件", () => {
  beforeEach(() => {
    process.env.PLUGIN_API_KEY = TEST_PLUGIN_KEY;
    process.env.PLUGIN_API_SECRET = TEST_PLUGIN_SECRET;
    process.env.PLUGIN_SIGN_SKEW_SECONDS = "300";
    process.env.PLUGIN_NONCE_TTL_SECONDS = "600";
  });

  test("签名合法时放行并写入鉴权上下文", () => {
    const rawBody = JSON.stringify({ platform: "meituan", otaOrderId: "MT-001" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = `nonce-ok-${Date.now()}`;
    const headers = buildSignedHeaders({
      method: "POST",
      path: "/api/plugin/orders",
      rawBody,
      timestamp,
      nonce
    });
    const { req, res } = buildReqRes({
      method: "POST",
      path: "/api/plugin/orders",
      rawBody,
      headers
    });

    let nextCalled = false;
    pluginAuth(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(req.pluginAuth).toBeTruthy();
    expect(req.pluginAuth.key).toBe(TEST_PLUGIN_KEY);
    expect(req.pluginAuth.nonce).toBe(nonce);
  });

  test("签名错误时返回 401", () => {
    const rawBody = JSON.stringify({ platform: "meituan", otaOrderId: "MT-002" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = `nonce-bad-sign-${Date.now()}`;
    const headers = buildSignedHeaders({
      method: "POST",
      path: "/api/plugin/orders",
      rawBody,
      timestamp,
      nonce
    });
    headers["x-plugin-signature"] = "deadbeef";

    const { req, res } = buildReqRes({
      method: "POST",
      path: "/api/plugin/orders",
      rawBody,
      headers
    });

    let nextCalled = false;
    pluginAuth(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("PLUGIN_AUTH_INVALID_SIGNATURE");
  });

  test("重复 nonce 返回 401 防重放", () => {
    const rawBody = JSON.stringify({ platform: "meituan", otaOrderId: "MT-003" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = `nonce-replay-${Date.now()}`;
    const headers = buildSignedHeaders({
      method: "POST",
      path: "/api/plugin/orders",
      rawBody,
      timestamp,
      nonce
    });

    const first = buildReqRes({
      method: "POST",
      path: "/api/plugin/orders",
      rawBody,
      headers
    });
    const second = buildReqRes({
      method: "POST",
      path: "/api/plugin/orders",
      rawBody,
      headers
    });

    let firstNextCalled = false;
    pluginAuth(first.req, first.res, () => {
      firstNextCalled = true;
    });
    expect(firstNextCalled).toBe(true);

    let secondNextCalled = false;
    pluginAuth(second.req, second.res, () => {
      secondNextCalled = true;
    });
    expect(secondNextCalled).toBe(false);
    expect(second.res.statusCode).toBe(401);
    expect(second.res.body.code).toBe("PLUGIN_AUTH_NONCE_REPLAYED");
  });
});
