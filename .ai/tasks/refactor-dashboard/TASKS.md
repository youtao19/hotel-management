# refactor-dashboard

## 目标

重构仪表盘模块，把 `/api/dashboard/memos` 的 HTTP 层、业务层和数据库访问迁移到 `backend/modules/dashboard/`，保持 API 路径、请求/响应格式、数据库结构、事务行为和日期时间语义不变。

## Phase 1: routes / controller / validator

- [x] 梳理前端仪表盘页面实际调用的 API。
- [x] 创建 `backend/modules/dashboard/dashboard.routes.js`。
- [x] 创建 `backend/modules/dashboard/dashboard.controller.js`。
- [x] 创建 `backend/modules/dashboard/dashboard.validator.js`。
- [x] 将 `backend/app.js` 挂载到新模块路由。
- [x] 将旧 `backend/routes/dashboardMemoRoute.js` 改为兼容导出，避免重复实现。
- [x] 创建 `backend/modules/dashboard/README.md` 作为模块接口文档。
- [x] 补充模块本地 validator/controller 单测。

## Phase 2: service

- [x] 创建 `backend/modules/dashboard/dashboard.service.js`。
- [x] 将备忘录默认日期、标题修剪、默认优先级和完成状态归一迁入 service。
- [x] controller 改为只处理 HTTP 参数、响应和错误映射。

## Phase 3: repository

- [x] 创建 `backend/modules/dashboard/dashboard.repository.js`。
- [x] 将 `dashboard_memos` 相关 SQL 迁入 repository。
- [x] `dashboardMemoModule.js` 不再直接写 SQL。
- [x] 补充 service/repository 单测。
- [x] 运行模块本地单测和时间字段回归测试。
