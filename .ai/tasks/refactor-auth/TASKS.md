# refactor-auth

## 目标

重构登录、注册、邮箱验证、密码重置和当前登录态相关接口到 `backend/modules/auth/`，保持 API 路径、请求/响应格式、数据库 schema、session 行为和日期时间语义不变。

## 范围

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

## Phase 1: routes / controller / validator

- [x] 创建任务状态文件。
- [x] 梳理前端登录、注册、邮箱验证和用户态接口调用。
- [x] 创建 `backend/modules/auth/auth.routes.js`。
- [x] 创建 `backend/modules/auth/authUser.routes.js`。
- [x] 创建 `backend/modules/auth/auth.controller.js`。
- [x] 创建 `backend/modules/auth/auth.validator.js`。
- [x] 注册新模块路由到 `/api/auth` 和 `/api/user`。
- [x] 将旧 `backend/routes/authRoute.js` / `backend/routes/userRoute.js` 改为兼容导出，避免重复实现。
- [x] 创建 `backend/modules/auth/README.md` 作为模块接口文档。
- [x] 补充模块本地 validator 单测。
- [x] 运行 auth 聚焦验证。

## Phase 2: service

- [x] 创建 `backend/modules/auth/auth.service.js`。
- [x] 将注册、登录限流、邮箱验证、密码重置和 session 用户查询业务流迁入 service。
- [x] controller 只处理 HTTP 参数、响应和错误映射。

## Phase 3: repository

- [x] 创建 `backend/modules/auth/auth.repository.js`。
- [x] 将 `account` 表 SQL 迁入 repository。
- [x] 保持 Redis code/session 行为不变。
- [x] 更新模块 README。
- [x] 补充 controller/validator 单测。

## Phase 4: middleware placement

- [x] 将根级 `backend/modules/authentication.js` 移入 `backend/modules/auth/auth.middleware.js`。
- [x] 更新 `backend/app.js`、auth 用户路由和跨模块认证引用。
- [x] 更新 auth / order-manage 模块 README。
- [x] 补充认证中间件单测。

## 非本次自动扩大范围

- 不改前端接口调用。
- 不改 session cookie 策略。
- 不改登录失败状态码和限流策略。
- 不改数据库表结构。
