"use strict";

const request = require('supertest');
const app = require('../app');
const { signAccountToken } = require('../modules/auth/jwt.helper');

const TEST_ACCOUNT = { id: 1, name: '测试账号', email: 'test@example.com' };

function validToken() {
  return signAccountToken(TEST_ACCOUNT);
}

function authHeader() {
  return { Authorization: `Bearer ${validToken()}` };
}

// 测试用的 Mock PLUGIN_API_TOKEN：证明插件入口不被员工 JWT 守卫拦截
const MOCK_PLUGIN_TOKEN = 'test-plugin-token-2026';

process.env.PLUGIN_API_TOKEN = MOCK_PLUGIN_TOKEN;

/**
 * 后台业务 API 路由级鉴权测试。
 * 覆盖 app.js 实际挂载顺序：公开路由 → 外部鉴权入口 → ensureAuthenticated → 业务路由。
 */
describe('后台业务 API 路由级鉴权', () => {
  test('无 Authorization 头访问后台业务 API 应返回 401', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('未登录');
  });

  test('非 Bearer 格式的 Authorization 应返回 401', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Token some-legacy-token');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('未登录');
  });

  test('Bearer 后 token 为空的请求应返回 401', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('未登录');
  });

  test('非法 JWT 访问后台业务 API 应返回 401', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer not.a.valid.jwt');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('未登录');
  });

  test('合法 JWT 可访问受保护的业务路由', async () => {
    // app.js 测试环境下 auth.routes 是公开的，business 路由由 ensureAuthenticated 保护。
    // /api/orders 列表中即使没有数据，路由注册和鉴权流程也被真实测试。
    const res = await request(app)
      .get('/api/orders')
      .set(authHeader());
    // 正常放行后，即使后端返回数据为空或参数校验缺失，也不应返回 401
    expect(res.status).not.toBe(401);
  });

  test('认证公开入口 /api/auth/login 不需要员工 JWT', async () => {
    // POST /api/auth/login 是公开入口，应直接由 auth 模块处理（不传 Authorization）
    const res = await request(app).post('/api/auth/login').send({
      email: 'no-such@example.com',
      pw: 'password'
    });
    expect(res.status).not.toBe(401);
  });

  test('健康检查 /api/hup 不需要员工 JWT', async () => {
    const res = await request(app).get('/api/hup');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('插件入口 /api/plugin/orders 应使用 PLUGIN_API_TOKEN Bearer 鉴权，不会被员工 JWT 放行', async () => {
    // 不带 Token → 应 401（由 pluginAuth 返回，不是员工 JWT 守卫）
    const noToken = await request(app).post('/api/plugin/orders');
    expect(noToken.status).toBe(401);

    // 带员工 JWT 但不是 PLUGIN_API_TOKEN → 应被 pluginAuth 拒绝
    const staffOnly = await request(app)
      .post('/api/plugin/orders')
      .set(authHeader())
      .send({});
    expect(staffOnly.status).toBe(401);

    // 带正确的 PLUGIN_API_TOKEN → pluginAuth 放行
    const pluginOk = await request(app)
      .post('/api/plugin/orders')
      .set('Authorization', `Bearer ${MOCK_PLUGIN_TOKEN}`)
      .send({});
    // pluginAuth 放行后，校验由业务 controller 执行（参数缺失等），不应是 401
    expect(pluginOk.status).not.toBe(401);
  });
});
