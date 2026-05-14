# move-change-room-to-order-manage

## 目标

把 `POST /api/rooms/change-room` 的订单换房流程从 `room-manage` 迁到 `order-manage`，保持公开 API 路径、请求/响应格式、数据库 schema、事务行为和日期语义不变。

## Checklist

- [x] 创建任务状态文件。
- [x] 读取 `order-manage`、`room-manage` 当前实现和换房测试。
- [x] 在 `order-manage` 增加 `/api/rooms/change-room` 兼容路由。
- [x] 将换房 controller/service/repository 迁入 `order-manage`。
- [x] 从 `room-manage` 移除换房实现和文档归属。
- [x] 运行聚焦测试验证。
