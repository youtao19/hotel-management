# refactor-review

## 目标

重构好评管理模块，把 `/api/reviews` 的 HTTP 层迁移到 `backend/modules/review/`，保持 API 路径、请求/响应格式、数据库结构、事务行为和日期时间语义不变。

## Phase 1: routes / controller / validator

- [x] 梳理旧 `backend/routes/reviewRoute.js` 的 API、调用链和测试覆盖。
- [x] 创建 `backend/modules/review/review.routes.js`。
- [x] 创建 `backend/modules/review/review.controller.js`。
- [x] 创建 `backend/modules/review/review.validator.js`。
- [x] 将 `backend/app.js` 挂载到新模块路由。
- [x] 将旧 `backend/routes/reviewRoute.js` 改为兼容导出，避免重复实现。
- [x] 创建 `backend/modules/review/README.md` 作为模块接口文档。
- [x] 补充模块本地 validator/controller 单测。
- [x] 运行模块本地单测和现有好评接口测试。

## Phase 2: service

- [x] 创建 `backend/modules/review/review.service.js`。
- [x] 将订单存在性检查、邀约状态判断和业务调用顺序迁入 service。
- [x] controller 改为只处理 HTTP 参数、响应和错误映射。
- [x] 旧 `reviewInvitationModule.js` 保留兼容导出。

## Phase 3: repository

- [x] 创建 `backend/modules/review/review.repository.js`。
- [x] 将 `review_invitations` 相关 SQL 迁入 repository。
- [x] `reviewInvitationModule.js` 不再直接写 SQL。
- [x] 更新 `backend/modules/review/README.md`。
- [x] 补充 service/repository 单测并更新 controller 单测。
- [x] 运行模块本地单测和现有好评接口测试。
