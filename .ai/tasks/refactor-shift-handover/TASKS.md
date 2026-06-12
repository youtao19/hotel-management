# refactor-shift-handover

## 目标

将交接班页面使用的 `/api/handover/*` 接口迁移到 `backend/modules/shift-handover`，保持 API 路径、请求/响应格式、数据库结构、事务行为和日期时间语义不变。

## 成功标准

- [x] `backend/modules/shift-handover` 成为交接班后端入口。
- [x] `backend/app.js` 挂载路径保持 `/api/handover` 不变。
- [x] 原 `backend/routes/handoverRoute.js` 不再保留重复实现。
- [x] 聚焦交接班测试通过。
- [x] 模块 README 说明接口、边界、依赖和当前迁移阶段。

## Phase 1：拆分路由、控制器和校验

- [x] 创建 `shiftHandover.routes.js`。
- [x] 创建 `shiftHandover.controller.js`。
- [x] 创建 `shiftHandover.validator.js`。
- [x] 迁移 `/overview`、`/handover-table`、`/special-stats`、`/admin-memos`、`/query`、`/complete` 路由入口。

## Phase 2：拆分业务流程

- [x] 创建 `shiftHandover.service.js`。
- [x] 将 controller 与旧 `handoverModule` 之间的业务编排移入 service。
- [x] 保持 `getHandoverOverview`、`getHandoverTableData`、`getAdminMemosFromHandover`、`recalculatePaymentData` 的既有计算行为不变。

## Phase 3：拆分数据库访问

- [x] 创建 `shiftHandover.repository.js`。
- [x] 将特殊统计 SQL 移入 repository。
- [x] 将历史交接记录查询 SQL 移入 repository。
- [x] 将完成交接班的事务写入移入 repository。

## 文档和验证

- [x] 创建 `backend/modules/shift-handover/README.md`。
- [x] 补充模块本地校验测试。
- [x] 运行交接班聚焦测试。
- [x] 检查最终 diff，确认提交范围只包含交接班模块重构。
