# auth

## 模块职责

`auth` 负责员工注册、登录、邮箱验证、密码重置、登出和当前登录态查询。登录态使用 JWT Bearer Token（HS256），不再依赖 `express-session`。

## API 接口

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/send-email-verification`
- `POST /api/auth/email-verify`
- `GET /api/auth/check/email/:email`
- `POST /api/auth/send-preset-email`
- `POST /api/auth/reset-pw`
- `GET /api/auth/check/reset-code/:code`
- `GET /api/user/logout`
- `GET /api/user/info`
- `GET /api/user/check/email`

## 当前阶段

Phase 5: 登录态已从 `express-session` 迁移到 JWT。后端登录成功后签发 14 天有效期的 HS256 JWT，前端通过 `localStorage` 保存 token，所有受保护请求携带 `Authorization: Bearer <token>`。

## 请求和响应

### `POST /api/auth/signup`

请求：

```json
{
  "email": "staff@example.com",
  "name": "张三",
  "pw": "password"
}
```

响应：

```json
{
  "id": 1,
  "name": "张三",
  "email": "staff@example.com"
}
```

### `POST /api/auth/login`

请求：

```json
{
  "email": "staff@example.com",
  "pw": "password"
}
```

成功响应（含 JWT token）：

```json
{
  "id": 1,
  "name": "张三",
  "email": "staff@example.com",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

失败状态码沿用旧接口：

- `450`: 用户不存在
- `451`: 密码错误
- `457`: 邮箱未验证
- `429`: 登录限流

### `POST /api/auth/send-email-verification`

请求：

```json
{
  "email": "staff@example.com"
}
```

响应：`200` 空 JSON。

### `POST /api/auth/email-verify`

请求：

```json
{
  "code": "verification-code"
}
```

响应：`200` 空 JSON。code 无效时返回旧状态码 `452`。

### `GET /api/auth/check/email/:email`

响应：

```json
{
  "exist": true
}
```

### `POST /api/auth/send-preset-email`

请求：

```json
{
  "email": "staff@example.com"
}
```

响应：`200` 空 JSON。接口名保留历史拼写。

### `POST /api/auth/reset-pw`

请求：

```json
{
  "pw": "new-password",
  "code": "reset-code"
}
```

响应：`200` 空 JSON。code 无效时返回旧状态码 `452`。

### `GET /api/auth/check/reset-code/:code`

响应：

```json
{
  "exist": true
}
```

### `GET /api/user/logout`

不需要认证。JWT 无状态，后端不维护 session 或 token 黑名单，仅向前端返回成功语义；前端收到响应后清理本地 token。

响应：

```json
{
  "message": "登出成功"
}
```

### `GET /api/user/info`

需要 `Authorization: Bearer <token>`。token 缺失/过期/非法时返回 `401`。

响应：

```json
{
  "id": 1,
  "name": "张三",
  "email": "staff@example.com",
  "email_verified": true
}
```

### `GET /api/user/check/email`

需要 `Authorization: Bearer <token>`。

响应：

```json
{
  "email_verified": true
}
```

## 业务流程

- `POST /api/auth/signup` -> `authService.signup()` -> `authRepository.createAccount()`
- `POST /api/auth/login` -> `authService.login()` -> `authRepository.findAccountByEmail()` -> controller 签发 JWT via `jwt.helper.signAccountToken()`
- `POST /api/auth/send-email-verification` -> `authService.sendEmailVerification()` -> Redis 验证码 -> `emailSetup.sendEmailVerification()`
- `POST /api/auth/email-verify` -> `authService.verifyEmail()` -> `authRepository.markEmailVerified()`
- `GET /api/auth/check/email/:email` -> `authService.checkEmail()` -> `authRepository.findEmail()`
- `POST /api/auth/send-preset-email` -> `authService.sendResetPasswordEmail()` -> Redis 验证码 -> `emailSetup.sendResetPWEmail()`
- `POST /api/auth/reset-pw` -> `authService.resetPassword()` -> `authRepository.updatePasswordByEmail()`
- `GET /api/auth/check/reset-code/:code` -> `authService.checkResetCode()`
- `GET /api/user/logout` -> `authController.logout()` -> 直接返回 200，前端清理 token
- `GET /api/user/info` -> `authService.getCurrentUser()` -> `authRepository.findAccountInfoById()`
- `GET /api/user/check/email` -> `authService.getCurrentUserEmailVerified()` -> `authRepository.findEmailVerifiedByAccountId()`
- 全局认证 -> `auth.middleware.authenticationMiddleware()` -> 从 `Authorization: Bearer <token>` 解析出 `req.account`
- 受保护后台业务 API -> `auth.middleware.ensureAuthenticated()` -> 检查 `req.account.id`，无则返回 `401`
- 后台业务 `/api` 路由在 `app.js` 统一通过 `ensureAuthenticated` 守卫；公开入口（`/api/auth/*`、`/api/user/logout`、`/api/hup`）和外部渠道入口（`/ota`、`/douyin`、`/api/plugin/*`）先于守卫挂载，使用自有鉴权方式

## 依赖说明

- `../../database/postgreDB/pg`
- `../../database/redis/redis`
- `../rateLimiter`
- `../emailSetup`
- `bcrypt`
- `jsonwebtoken`
- `nanoid`
- `ajv`
- `ajv-formats`

## 注意事项

- API 路径不能改。
- 请求和响应格式不能改。
- 登录成功响应新增 `token` 字段；失败响应保持不变。
- 登录失败状态码和 `Retry-After` 行为继续沿用旧接口。
- 未验证邮箱仍计入登录失败限流，避免绕过账号保护。
- 登出接口不要求认证，前端在 token 失效时也可调用并清理本地 token。
- 前端不承载核心业务规则；业务校验、权限判断、数据一致性逻辑放在后端 API。
- `jwt.helper.js` 是 JWT 签发和校验的唯一入口；生产环境缺少 `JWT_SECRET` 环境变量应启动失败。
- 插件入口继续使用 `PLUGIN_API_TOKEN` Bearer 鉴权，不走员工 JWT。
- Redis 验证码前缀继续使用 `emailVerification` 和 `resetPassword`。
- `account.created_at` 仍由当前 Node `Date` 写入；本次不改数据库 schema 和时间语义。
