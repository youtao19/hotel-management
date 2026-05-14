# refactor-room-status

## 范围

重构房间状态模块，迁移房态页面和手动改房态相关后端 API 到 `backend/modules/room-status/`。

## API

- [x] `GET /api/rooms`
- [x] `GET /api/rooms/status-range`
- [x] `GET /api/rooms/calendar-board`
- [x] `PATCH /api/rooms/:number/status`

## 阶段

- [x] Phase 1: routes/controller/validator 拆分
- [x] Phase 2: service 拆分
- [x] Phase 3: repository 拆分
- [x] 更新模块 README
- [x] 移除旧路由重复实现
- [x] 聚焦测试通过
- [x] PR 准备完成

## 非本次范围

- `GET /api/rooms/available`
- `GET /api/rooms/number/:number`
- `POST /api/rooms`
- `PUT /api/rooms/:room_number`
- `DELETE /api/rooms/:room_number`
- `POST /api/rooms/change-room`
