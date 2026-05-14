# room-status

## 模块职责

`room-status` 负责房间状态页的单日房态、14 天日历房态、单房间区间房态和手动修改基础房态。

## API 接口

- `GET /api/rooms`
- `GET /api/rooms/status-range`
- `GET /api/rooms/calendar-board`
- `PATCH /api/rooms/:number/status`

## 当前阶段

Phase 3: routes/controller/validator/service/repository 已拆分。房态展示 SQL、筛选汇总、手动状态更新已迁入本模块。

## 业务流程

- `GET /api/rooms` -> `roomStatusService.listRoomStatus()` -> `roomStatusRepository.listRoomStatusRows()`
- `GET /api/rooms/status-range` -> `roomStatusService.getRoomStatusRange()` -> `roomStatusRepository.listRoomStatusRangeRows()`
- `GET /api/rooms/calendar-board` -> `roomStatusService.getCalendarBoard()` -> `roomStatusRepository.listCalendarBoardRows()`
- `PATCH /api/rooms/:number/status` -> `roomStatusService.updateRoomStatus()` -> `roomStatusRepository.updateRoomStatus()`

## 请求和响应

### `GET /api/rooms`

Query:

- `date`: 可选，`YYYY-MM-DD`
- `typeCode`: 可选，房型编码
- `status`: 可选，`available | occupied | cleaning | repair | reserved`
- `keyword`: 可选，按房号、订单号、客人、电话、备注匹配

Response:

```json
{
  "data": [],
  "summary": {
    "date": "2025-12-10",
    "total": 0,
    "available": 0,
    "occupied": 0,
    "reserved": 0,
    "cleaning": 0,
    "repair": 0
  },
  "query": {
    "date": "2025-12-10",
    "typeCode": null,
    "status": null,
    "keyword": null
  },
  "message": "查询到 2025-12-10 的房间状态"
}
```

### `GET /api/rooms/status-range`

Query:

- `roomNumber`: 必填，房间号
- `startDate`: 必填，`YYYY-MM-DD`
- `endDate`: 必填，`YYYY-MM-DD`

Response:

```json
{
  "data": [
    {
      "stay_date": "2025-12-10",
      "room_number": "101",
      "display_status": "reserved"
    }
  ],
  "query": {
    "roomNumber": "101",
    "startDate": "2025-12-10",
    "endDate": "2025-12-12"
  }
}
```

### `GET /api/rooms/calendar-board`

Query:

- `startDate`: 必填，`YYYY-MM-DD`
- `days`: 可选，目前仅支持 `14`
- `typeCode`: 可选，房型编码
- `status`: 可选，`available | occupied | cleaning | repair | reserved`
- `keyword`: 可选，按房号、订单号、客人、电话、备注匹配

Response:

```json
{
  "query": {
    "startDate": "2025-12-10",
    "days": 14,
    "typeCode": null,
    "status": null,
    "keyword": ""
  },
  "summary": {},
  "dailySummary": [],
  "rooms": []
}
```

### `PATCH /api/rooms/:number/status`

Request:

```json
{
  "status": "cleaning"
}
```

Response:

```json
{
  "data": {
    "room_number": "101",
    "status": "cleaning",
    "is_closed": false
  }
}
```

## 依赖说明

- `../../database/postgreDB/pg`
- `rooms`
- `room_types`
- `orders`

## 注意事项

- API 路径不能改，旧 `/api/rooms` 挂载点仍然保留。
- `display_status` 是展示状态：维修优先，其次订单占用/预订，再其次清扫，最后空闲。
- `PATCH /api/rooms/:number/status` 只改房间基础状态，不改订单状态。
- 状态设为 `repair` 时同步 `is_closed=true`；其他状态同步 `is_closed=false`，这会影响可用房和渠道库存。
- DATE 字段按 `YYYY-MM-DD` 字符串处理，不使用 `toISOString()` 做业务转换。
