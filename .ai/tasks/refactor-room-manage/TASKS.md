# refactor-room-manage

## 目标

重构房间管理模块到 `backend/modules/room-manage/`，保持现有 API 路径、请求/响应格式、数据库 schema、事务行为和日期语义不变。

## Checklist

- [x] 创建任务状态文件。
- [x] 读取 `backend/app.js`、旧 `backend/routes/roomRoute.js`、现有测试和相关接口文档。
- [x] Phase 1: 拆分 `roomManage.routes.js`。
- [x] Phase 1: 拆分 `roomManage.controller.js`。
- [x] Phase 1: 拆分 `roomManage.validator.js`。
- [x] Phase 1: 注册新模块路由到 `/api/rooms`。
- [x] Phase 1: 删除旧路由重复实现。
- [x] Phase 1: 新增模块 README 并更新全局接口文档索引。
- [x] Phase 1: 运行聚焦房间管理 API 测试。
- [x] Phase 2: 拆分 `roomManage.service.js`。
- [x] Phase 3: 拆分 `roomManage.repository.js`。
- [x] Phase 3: 运行聚焦房间管理 API 测试。
- [x] 最终 diff 范围检查。
