# room-manage

## 模块职责

`room-manage` 负责房间列表、单日/日历房态、可用房查询、房间增删改、房态修改和整单换房接口。

## API 接口

- `GET /api/rooms`
- `GET /api/rooms/available`
- `GET /api/rooms/status-range`
- `GET /api/rooms/calendar-board`
- `GET /api/rooms/number/:number`
- `POST /api/rooms`
- `PATCH /api/rooms/:number/status`
- `PUT /api/rooms/:room_number`
- `DELETE /api/rooms/:room_number`
- `POST /api/rooms/change-room`

## 当前阶段

Phase 3: routes/controller/validator/service/repository 已拆分。房间列表、日历房态、可用房查询、房间增删改、房态修改和整单换房已迁入本模块，旧 `roomModule.js` 已移除。

## 业务流程

- `GET /api/rooms` -> `roomManageService.listRooms()` -> `roomManageRepository.listRoomsByDate()`
- `GET /api/rooms/available` -> `roomManageService.listAvailableRooms()` -> `roomManageRepository.listAvailableRooms()`
- `GET /api/rooms/status-range` -> `roomManageService.getRoomStatusRange()` -> `roomManageRepository.listRoomStatusRange()`
- `GET /api/rooms/calendar-board` -> `roomManageService.getCalendarBoard()` -> `roomManageRepository.listCalendarBoardRows()`
- `GET /api/rooms/number/:number` -> `roomManageService.getRoomByNumber()` -> `roomManageRepository.findRoomByNumber()`
- `POST /api/rooms` -> `roomManageService.addRoom()` -> `roomManageRepository`
- `PATCH /api/rooms/:number/status` -> `roomManageService.updateRoomStatus()` -> `roomManageRepository.updateRoomStatus()`
- `PUT /api/rooms/:room_number` -> `roomManageService.updateRoom()` -> `roomManageRepository.updateRoom()`
- `DELETE /api/rooms/:room_number` -> `roomManageService.deleteRoom()` -> `roomManageRepository`
- `POST /api/rooms/change-room` -> `roomManageService.changeOrderRoom()` -> `roomManageRepository`

## 请求与响应

### GET /api/rooms

Query:

```json
{
  "date": "YYYY-MM-DD",
  "typeCode": "string",
  "status": "available|occupied|cleaning|repair|reserved",
  "keyword": "string"
}
```

成功响应：

```json
{
  "data": [],
  "summary": {},
  "query": {},
  "message": "查询到当前房间状态"
}
```

### GET /api/rooms/available

Query:

```json
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "typeCode": "string"
}
```

成功响应：

```json
{
  "data": [],
  "query": {
    "startDate": "2026-02-10",
    "endDate": "2026-02-12",
    "typeCode": null
  }
}
```

### POST /api/rooms/change-room

请求体：

```json
{
  "orderNumber": "ORD20260208001",
  "oldRoomNumber": "202",
  "newRoomNumber": "401"
}
```

成功响应继续沿用历史换房接口的返回结构。

## 依赖说明

- `../../database/postgreDB/pg`
- `ajv`
- `ajv-formats`

## 测试

真实 API 和数据库集成测试继续保留在：

```txt
backend/tests/room_number.test.js
backend/tests/room_display_status_api.test.js
backend/tests/change_room_cross_type.test.js
backend/tests/room_status_day_room_change.test.js
```

当前推荐验收命令：

```bash
npm --workspace backend run test -- tests/room_number.test.js tests/room_display_status_api.test.js tests/change_room_cross_type.test.js tests/room_status_day_room_change.test.js
```

## 注意事项

- API 路径不能改。
- 请求和响应格式不能改。
- DATE 字段按 `YYYY-MM-DD` 字符串处理，不使用 `toISOString()`。
- 新增房间仍使用独立 client 事务。
- 整单换房沿用旧的全局 `BEGIN` / `COMMIT` / `ROLLBACK` 调用方式，避免本轮重构改变事务边界。
