# dashboard

## 模块职责

本模块服务前端“仪表盘”页面，当前负责仪表盘备忘录的查询、创建、更新和删除。

不归属本模块：

- 房间状态概览：归 `room-status`
- 最近入住客人：归 `order-manage`
- 收入统计：归 `income-statistics` / 当前 `revenueRoute`

## API 接口

- `GET /api/dashboard/memos?date=YYYY-MM-DD`
- `POST /api/dashboard/memos`
- `PUT /api/dashboard/memos/:memoId`
- `DELETE /api/dashboard/memos/:memoId`

## 请求格式

### GET /api/dashboard/memos

Query:

```json
{
  "date": "2026-05-15"
}
```

`date` 不传时默认使用服务器当前日期，按 `YYYY-MM-DD` 字符串处理。

### POST /api/dashboard/memos

```json
{
  "memo_date": "2026-05-15",
  "title": "联系客人确认到店时间",
  "priority": "medium",
  "completed": false
}
```

- `memo_date` 和 `title` 必填
- `priority` 可选：`low`、`medium`、`high`，默认 `medium`
- `completed` 可选，默认 `false`

### PUT /api/dashboard/memos/:memoId

```json
{
  "title": "更新后的备忘录",
  "priority": "high",
  "completed": true,
  "memo_date": "2026-05-16"
}
```

至少传一个字段。

## 响应格式

### 查询成功

```json
{
  "data": [
    {
      "memo_id": 1,
      "memo_date": "2026-05-15",
      "title": "联系客人确认到店时间",
      "priority": "medium",
      "completed": false,
      "created_at": "2026-05-15T08:00:00.000Z",
      "updated_at": "2026-05-15T08:00:00.000Z"
    }
  ],
  "date": "2026-05-15"
}
```

### 创建或更新成功

```json
{
  "data": {
    "memo_id": 1,
    "memo_date": "2026-05-15",
    "title": "联系客人确认到店时间",
    "priority": "medium",
    "completed": false,
    "created_at": "2026-05-15T08:00:00.000Z",
    "updated_at": "2026-05-15T08:00:00.000Z"
  }
}
```

### 删除成功

HTTP `204`，无响应体。

## 当前阶段

Phase 3: routes/controller/validator/service/repository 已拆分，旧 `dashboardMemoRoute.js` 和 `dashboardMemoModule.js` 保留兼容导出。

## 业务流程

- `GET /api/dashboard/memos` -> `dashboard.service.listMemos()` -> `dashboard.repository.findMemosByDate()`
- `POST /api/dashboard/memos` -> `dashboard.service.createMemo()` -> `dashboard.repository.insertMemo()`
- `PUT /api/dashboard/memos/:memoId` -> `dashboard.service.updateMemo()` -> `dashboard.repository.updateMemoById()`
- `DELETE /api/dashboard/memos/:memoId` -> `dashboard.service.deleteMemo()` -> `dashboard.repository.deleteMemoById()`

## 依赖说明

- `dashboard_memos` 表
- `../tools.formatDate`

## 注意事项

- API 路径不能改。
- 请求和响应格式保持旧接口兼容。
- `memo_date` 是 DATE 字段，只按 `YYYY-MM-DD` 字符串处理。
- `created_at`、`updated_at` 是数据库时间字段，不在 Node.js 中手动换算时区。
