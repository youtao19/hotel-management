# JWT 迁移审查问题修复设计

## 背景

当前员工登录态正在从 `express-session` 迁移到 JWT Bearer token。审查发现 4 个需要在合并前收口的问题：

- 测试环境下受保护业务 API 被整体放行，真实路由级 401 行为没有被集成测试证明。
- `backend/modules/auth/README.md` 仍描述旧 session 登录流程。
- 前端在 `/user/info` 返回 401 时不会清理过期 token。
- `npm run test -- --runInBand` 测试主体通过后 Jest 没有自然退出。

本设计只处理这些迁移收口问题，不新增权限模型、refresh token、token 黑名单或 UI 行为。

## 目标

- `ensureAuthenticated` 在测试环境和真实环境使用同一套 JWT 判断逻辑。
- 后台业务 `/api` 路由的无 token、格式错误 token、非法 token、合法 token 行为被真实 Express 路由测试覆盖。
- 现有业务集成测试通过统一 helper 携带测试 JWT，不在每个测试中手写签名细节。
- `/user/info` 的 401 仍然静默，但会清理本地过期 token。
- 认证模块 README 与 JWT 实现一致。
- Jest 测试命令能自然退出，不需要手动中断。

## 非目标

- 不改变 `/api/auth/login` 之外的认证接口路径。
- 不把插件 `PLUGIN_API_TOKEN` 鉴权改成员工 JWT。
- 不增加 refresh token、服务端 token 黑名单或角色权限模型。
- 不重构无关业务模块。

## 后端鉴权设计

`backend/modules/auth/auth.middleware.js` 中的 `ensureAuthenticated` 不再根据 `setup.env === "test"` 放行。只要请求进入受保护路由，就必须已经由 `authenticationMiddleware` 从 `Authorization: Bearer <token>` 解析出 `req.account.id`。缺失或校验失败时统一返回：

```json
{
  "message": "未登录"
}
```

公开入口保持现有挂载顺序：

- `/api/auth/*` 保持公开，用于注册、登录、邮箱验证和密码重置。
- `/api/user/logout` 保持公开，表达前端清理 token 的登出语义。
- `/api/hup` 保持公开。
- `/ota`、`/douyin`、`/api/plugin*` 保持各自签名或 `PLUGIN_API_TOKEN` 鉴权，不走员工 JWT。
- 之后挂载的后台业务 `/api` 路由统一经过员工 JWT 守卫。

## 测试设计

在 `backend/tests/tools.js` 增加统一认证 helper：

- `createTestAuthToken(accountOverride)`：使用现有 `jwt.helper.signAccountToken()` 签发测试员工 JWT。
- `authHeader(accountOverride)`：返回 `{ Authorization: "Bearer <token>" }`，供 supertest `.set(authHeader())` 使用。

现有访问后台业务 `/api` 的集成测试统一通过 `authHeader()` 注入员工 JWT。测试只表达“这是已登录员工请求”，不关心签名算法和密钥细节。

新增真实路由保护测试，覆盖实际 `app.js` 挂载顺序：

- 无 `Authorization` 访问后台业务 API 返回 401。
- 非 `Bearer` 格式返回 401。
- 非法 JWT 返回 401。
- 合法 JWT 可以进入业务路由。
- 插件入口继续使用 `PLUGIN_API_TOKEN`，不被员工 JWT 守卫拦截。

中间件单测继续保留，用于覆盖 token 解析边界；路由级测试用于证明业务 API 确实被统一保护。

## 前端 Token 清理设计

`frontend/src/api/index.js` 的响应拦截器保持登录请求特殊处理：`/auth/login` 的 401 由登录页展示错误，不清理 token。

其他非登录请求遇到 401 时统一调用 `setAuthToken(null)`。其中 `/user/info` 仍然静默处理，不输出警告或错误日志，但必须删除本地 `auth_token`。这样刷新页面遇到过期 token 时，`checkAuth()` 会把用户态置为未登录，后续请求也不会继续携带坏 token。

`frontend/src/stores/userStore.js` 继续负责用户态切换：`fetchCurrentUser()` 捕获 `/user/info` 401 后返回 `null` 并设置未登录状态，不重复实现 token 清理。

## 文档设计

更新 `backend/modules/auth/README.md`，使认证模块文档与 JWT 迁移后的实现一致：

- `POST /api/auth/login` 成功响应包含 `token`。
- `GET /api/user/info` 和 `GET /api/user/check/email` 标明需要 `Authorization: Bearer <token>`。
- 登录流程描述为 controller 在 `authService.login()` 成功后签发 JWT。
- 登出流程描述为前端清理 token 的成功语义，后端不维护 session 或 token 黑名单。
- 全局认证流程描述为 Bearer token 解析和 `ensureAuthenticated` 守卫，不再提 `req.login()`、`req.logout()`、`req.isAuthenticated()` 或 session 初始化。

## Jest 未退出诊断设计

先用证据定位，不预设原因：

1. 运行 `npm run test -- --runInBand --detectOpenHandles`，记录未关闭句柄来源。
2. 如果来源是数据库或 Redis 连接，修复对应 close 流程，确保 `backend/tests/setup.js` 的 `afterAll` 可靠释放资源。
3. 如果来源是 Express app 初始化或重复挂载导致的残留，收敛初始化逻辑，确保测试只初始化必要资源。
4. 验证 `npm run test -- --runInBand` 能自然退出。

## 验证标准

- `npm run test -- --runInBand` 通过并自然退出。
- `npm run build` 通过。
- 新增路由级鉴权测试能证明后台业务 API 无 token 返回 401，合法 JWT 放行。
- 插件 API 测试仍使用 `PLUGIN_API_TOKEN` 并通过。
- 前端构建后 `/user/info` 401 的本地 token 清理逻辑存在于响应拦截器中。
