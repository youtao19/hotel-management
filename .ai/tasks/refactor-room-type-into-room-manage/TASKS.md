# refactor-room-type-into-room-manage

## 目标

把旧 `backend/routes/roomTypeRoute.js` 的 `/api/room-types` 房型 CRUD 迁入 `backend/modules/room-manage/`，保持 API 路径、请求/响应格式、数据库 schema、事务行为和日期语义不变，然后删除旧路由文件。

## Checklist

- [x] 创建任务状态文件。
- [x] 读取 `backend/app.js`、旧 `roomTypeRoute.js`、前端房型调用和 `room_type.test.js`。
- [x] 在 `room-manage` 增加 `/api/room-types` 的 router/controller/service/repository/validator 实现。
- [x] 更新 `backend/app.js`，让 `/api/room-types` 挂载到 `room-manage`。
- [x] 删除 `backend/routes/roomTypeRoute.js`。
- [x] 更新 `room-manage` README。
- [x] 运行聚焦测试验证。
