# room-manage

## 模块职责

`room-manage` 负责房间主数据维护、房型维护、可用房查询和单房查询接口。

不归属本模块：

- 房态页单日/日历房态查询：归 `room-status`
- 手动修改房间基础状态：归 `room-status`
- 创建订单时锁定房间：归 `order-create`
- 订单管理页整单换房：归 `order-manage`
- 订单退房释放房间：归 `order-manage` 或 `room-status`，以页面入口为准
- 抖音房型映射和库存同步：归 `douyin-manage`

## API 接口

- `GET /api/rooms/available`
- `GET /api/rooms/number/:number`
- `POST /api/rooms`
- `PUT /api/rooms/:room_number`
- `DELETE /api/rooms/:room_number`
- `GET /api/room-types`
- `GET /api/room-types/:code`
- `POST /api/room-types`
- `PUT /api/room-types/:code`
- `DELETE /api/room-types/:code`

## 当前阶段

Phase 3: routes/controller/validator/service/repository 已拆分。可用房查询、单房查询、房间增删改和房型增删改查保留在本模块；房态页查询、手动改房态和订单管理页整单换房已拆到对应模块。

## 业务流程

- `GET /api/rooms/available` -> `roomManageService.listAvailableRooms()` -> `roomManageRepository.listAvailableRooms()`
- `GET /api/rooms/number/:number` -> `roomManageService.getRoomByNumber()` -> `roomManageRepository.findRoomByNumber()`
- `POST /api/rooms` -> `roomManageService.addRoom()` -> `roomManageRepository`
- `PUT /api/rooms/:room_number` -> `roomManageService.updateRoom()` -> `roomManageRepository.updateRoom()`
- `DELETE /api/rooms/:room_number` -> `roomManageService.deleteRoom()` -> `roomManageRepository`
- `GET /api/room-types` -> `roomManageService.listRoomTypes()` -> `roomManageRepository.listRoomTypes()`
- `GET /api/room-types/:code` -> `roomManageService.getRoomTypeByCode()` -> `roomManageRepository.findRoomTypeByCode()`
- `POST /api/room-types` -> `roomManageService.addRoomType()` -> `roomManageRepository.insertRoomType()`
- `PUT /api/room-types/:code` -> `roomManageService.updateRoomType()` -> `roomManageRepository`
- `DELETE /api/room-types/:code` -> `roomManageService.deleteRoomType()` -> `roomManageRepository`

## 请求与响应

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

### GET /api/room-types

成功响应：

```json
{
  "data": []
}
```

### GET /api/room-types/:code

成功响应：

```json
{
  "data": {
    "type_code": "DELUXE",
    "type_name": "豪华房",
    "base_price": "300.00",
    "description": "宽敞舒适的豪华房"
  }
}
```

### POST /api/room-types

请求体：

```json
{
  "type_code": "DELUXE",
  "type_name": "豪华房",
  "base_price": 300,
  "description": "宽敞舒适的豪华房"
}
```

成功响应：

```json
{
  "data": {}
}
```

### PUT /api/room-types/:code

请求体继续要求包含 `type_code`、`type_name`、`base_price`，并拒绝额外字段。

成功响应：

```json
{
  "data": {},
  "syncedRooms": 0
}
```

### DELETE /api/room-types/:code

成功响应：

```json
{
  "message": "房型删除成功"
}
```

## 依赖说明

- `../../database/postgreDB/pg`
- `ajv`
- `ajv-formats`

## 测试

真实 API 和数据库集成测试继续保留在：

```txt
backend/tests/room_number.test.js
backend/tests/room_type.test.js
backend/tests/change_room_cross_type.test.js
```

当前推荐验收命令：

```bash
npm --workspace backend run test -- tests/room_type.test.js tests/room_number.test.js tests/change_room_cross_type.test.js
```

## 注意事项

- API 路径不能改。
- 请求和响应格式不能改。
- DATE 字段按 `YYYY-MM-DD` 字符串处理，不使用 `toISOString()`。
- 新增房间仍使用独立 client 事务。
- 修改房型基础价格时同步同房型房间价格，并沿用旧事务边界。
- `/api/rooms`、`/api/rooms/status-range`、`/api/rooms/calendar-board`、`/api/rooms/:number/status` 由 `room-status` 挂载处理。
- `/api/rooms/change-room` 保持旧路径，由 `order-manage` 挂载处理。
