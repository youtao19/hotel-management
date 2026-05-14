# split-room-status-from-room-manage

## 目标

重新审视 `room-manage` 和 `room-status` 边界，把误放在 `room-manage` 的房态页能力拆回 `room-status`，保持 API 路径、请求/响应格式、数据库 schema、事务行为和日期语义不变。

## Checklist

- [x] 创建任务状态文件。
- [x] 读取 `AGENTS.md`、`backend/app.js`、前端房间管理/房态页面和两个模块当前实现。
- [x] 从 `room-manage` 移除重复的房态页路由。
- [x] 从 `room-manage` 移除重复的房态 controller/service/repository/validator 代码。
- [x] 更新 `room-manage` / `room-status` README，明确模块边界。
- [x] 运行聚焦测试验证。
