# auth

## 模块职责

`auth` 负责员工注册、登录、邮箱验证、密码重置、登出和当前登录态查询。

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

Phase 3: routes/controller/validator/service/repository 已拆分。旧 `backend/routes/authRoute.js` 和 `backend/routes/userRoute.js` 仅保留兼容导出，实际实现位于 `backend/modules/auth/`。

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

响应：

```json
{
  "id": 1,
  "name": "张三",
  "email": "staff@example.com"
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

响应：

```json
{
  "message": "登出成功"
}
```

异常时仍会清理 cookie，并返回：

```json
{
  "message": "登出完成"
}
```

### `GET /api/user/info`

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

响应：

```json
{
  "email_verified": true
}
```

## 业务流程

- `POST /api/auth/signup` -> `authService.signup()` -> `authRepository.createAccount()`
- `POST /api/auth/login` -> `authService.login()` -> `authRepository.findAccountByEmail()` -> `req.login()`
- `POST /api/auth/send-email-verification` -> `authService.sendEmailVerification()` -> Redis 验证码 -> `emailSetup.sendEmailVerification()`
- `POST /api/auth/email-verify` -> `authService.verifyEmail()` -> `authRepository.markEmailVerified()`
- `GET /api/auth/check/email/:email` -> `authService.checkEmail()` -> `authRepository.findEmail()`
- `POST /api/auth/send-preset-email` -> `authService.sendResetPasswordEmail()` -> Redis 验证码 -> `emailSetup.sendResetPWEmail()`
- `POST /api/auth/reset-pw` -> `authService.resetPassword()` -> `authRepository.updatePasswordByEmail()`
- `GET /api/auth/check/reset-code/:code` -> `authService.checkResetCode()`
- `GET /api/user/logout` -> `authController.logout()` -> `req.logout()` / `res.clearCookie()`
- `GET /api/user/info` -> `authService.getCurrentUser()` -> `authRepository.findAccountInfoById()`
- `GET /api/user/check/email` -> `authService.getCurrentUserEmailVerified()` -> `authRepository.findEmailVerifiedByAccountId()`

## 依赖说明

- `../../database/postgreDB/pg`
- `../../database/redis/redis`
- `../authentication`
- `../rateLimiter`
- `../emailSetup`
- `bcrypt`
- `nanoid`
- `ajv`
- `ajv-formats`

## 注意事项

- API 路径不能改。
- 请求和响应格式不能改。
- 登录失败状态码和 `Retry-After` 行为继续沿用旧接口。
- 未验证邮箱仍计入登录失败限流，避免绕过账号保护。
- 登出接口不要求认证，session 过期时也要允许前端清 cookie。
- Redis 验证码前缀继续使用 `emailVerification` 和 `resetPassword`。
- `account.created_at` 仍由当前 Node `Date` 写入；本次不改数据库 schema 和时间语义。
