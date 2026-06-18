# Session 登录态迁移为 JWT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Keep the checkbox (`- [ ]`) status updated as work progresses.

**Goal:** 将当前员工登录态从 `express-session` cookie 迁移为 JWT Bearer Token，并统一保护后台业务 API。

**Architecture:** 后端登录成功后签发 14 天有效期的 JWT，前端将 token 保存到 `localStorage`，所有受保护请求通过 `Authorization: Bearer <token>` 发送。后端认证中间件只校验 Bearer token，并把账号信息挂到 `req.account`；不再使用 Redis session 存储登录态，Redis 继续用于验证码和登录限流。

**Tech Stack:** Node.js、Express、JWT、Vue 3、Quasar、Pinia、Axios、Jest、Playwright

---

## 成功标准

- [x] 登录成功响应保留 `id/name/email`，并追加 `token`。
- [x] 前端登录后保存 JWT，刷新页面仍能通过 `/api/user/info` 恢复登录态。
- [x] 前端业务请求统一携带 `Authorization: Bearer <token>`。
- [x] 无 token、格式错误、过期或非法 token 访问后台业务 API 时返回 `401`。
- [x] `req.session.account` 依赖被迁移到 `req.account`。
- [x] 后端不再为员工登录态注册 `express-session` 和 Redis session store。
- [x] 插件接口继续使用现有 `PLUGIN_API_TOKEN` Bearer 鉴权，不改成员工 JWT。
- [x] 登录失败状态码、邮箱验证、密码重置、登录限流行为保持不变。
- [x] 接口文档和 README/env 文档同步更新。
- [x] `npm run test` 通过；若改动触及前端构建链路，`npm run build` 也通过。

## 关键改动

- [x] 新增 JWT helper，使用 `JWT_SECRET` 签发和校验 HS256 token；生产环境缺少 `JWT_SECRET` 应启动失败，开发/测试环境可 fallback 到现有 `sessionSecret`。
- [x] 修改 `auth.service.login()`，移除 `login` 回调参数，只返回登录账号和原有错误结果。
- [x] 修改 `auth.controller.login()`，登录成功后签发 token，并把 token 追加到响应体。
- [x] 修改 `auth.middleware.js`，从 `Authorization` 请求头读取 Bearer token，校验通过后写入 `req.account = { id, name, email }`。
- [x] 修改所有读取 `req.session.account` 的后端代码，改为读取 `req.account`。
- [x] 修改 `backend/app.js`，移除 session middleware 和 Redis session store；公开路由先挂载，后台业务 `/api` 路由统一加员工 JWT 鉴权，OTA/插件外部入口保持原鉴权方式。
- [x] 修改前端 axios 配置，移除 session cookie 依赖，请求拦截器读取本地 token 并写入 `Authorization`；响应 401 时清理 token 和用户态。
- [x] 修改 `userStore`，登录保存 token，登出清 token；无 token 时 `checkAuth` 直接判定未登录，有 token 时再请求 `/api/user/info`。

## 接口变化

`POST /api/auth/login` 成功响应：

```json
{
  "id": 1,
  "name": "张三",
  "email": "staff@example.com",
  "token": "jwt-token"
}
```

受保护后台业务 API 需要请求头：

```http
Authorization: Bearer <token>
```

`GET /api/user/logout` 继续返回成功，但语义改为前端清理 token；后端不维护 session 或 token 黑名单。

## 测试计划

- [x] 更新 `auth.middleware` 单元测试：无 token、格式错误、过期 token、非法 token、合法 token。
- [x] 更新 `auth.controller` 测试：登录成功返回 token；限流、密码错误、未验证邮箱行为不变。
- [x] 增加受保护业务 API 测试：无 Bearer token 返回 401，带合法 token 可以访问。
- [ ] 前端验证登录、刷新恢复登录态、登出、业务请求带 Authorization。
- [x] 运行 `npm run test`。
- [x] 如前端构建链路受影响，运行 `npm run build`。

## 默认选择和约束

- [x] JWT 传输方式：Bearer token + `localStorage`。
- [x] token 有效期：14 天 access token。
- [x] 不新增 refresh token。
- [x] 不做服务端 token 黑名单。
- [x] 不新增权限角色模型。
- [x] 统一保护后台业务 API 是本次有意的行为变化。
- [x] 修改接口后必须同步更新接口文档。
- [x] 前端不承载核心业务规则；权限判断和数据一致性逻辑放在后端 API。
