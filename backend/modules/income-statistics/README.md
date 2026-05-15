# income-statistics

## 模块职责

`income-statistics` 服务前端“收入统计”页面，负责收入快速统计、趋势序列、房型收入贡献、每日营收明细和详细账单筛选。

不归属本模块：

- 其他收入录入：归 `bill` 模块的 `POST /api/bills/other-income`
- 交接班现金核对：归 `shift-handover` / 当前 `handoverRoute`
- 未接入收入统计页面的 `/api/revenue/receipts`：暂留旧 `revenueRoute`

## API 接口

- `GET /api/revenue/quick-stats`
- `GET /api/revenue/series`
- `GET /api/revenue/room-type`
- `GET /api/revenue/daily-details`
- `GET /api/revenue/bills`

## 当前阶段

Phase 3: routes/controller/validator/service/repository 已拆分，API 路径、请求参数、响应格式和收入口径保持不变。

## 业务流程

- `GET /api/revenue/quick-stats` -> `incomeStatisticsService.getQuickStats()` -> `incomeStatisticsRepository.getQuickStatsSummary()`
- `GET /api/revenue/series` -> `incomeStatisticsService.getSeries()` -> 按 `bucket` 调用日/周/月收入聚合
- `GET /api/revenue/room-type` -> `incomeStatisticsService.getRoomTypeRevenue()` -> 房型维度收入聚合
- `GET /api/revenue/daily-details` -> `incomeStatisticsService.getDailyDetails()` -> 统一房费、补收、租车收入明细
- `GET /api/revenue/bills` -> `incomeStatisticsService.getRevenueBills()` -> 账单明细筛选

## 收入口径

- 订单房费收入：`orders.total_price`，按 `orders.stay_date` 计入，排除 `status='cancelled'`。
- 订单补收收入：`bills.change_type='补收'` 且金额大于 0，按 `DATE(bills.create_time)` 计入。
- 租车收入：`bills.stay_type='租车收入'` 且金额大于 0，按 `DATE(bills.create_time)` 计入。
- `roomType` 过滤只作用于可归属房型的收入；租车收入无房型归属，筛选房型时不计入。

## 请求和响应

### `GET /api/revenue/quick-stats`

Query:

- `baseDate` 可选，`YYYY-MM-DD`
- `startDate` 可选，`YYYY-MM-DD`
- `endDate` 可选，`YYYY-MM-DD`

Response:

```json
{
  "message": "获取快速统计数据成功",
  "data": {
    "today": { "total_orders": 0, "total_revenue": 0, "period": "today", "date": "2026-02-10", "label": "今日收入" },
    "thisWeek": { "total_orders": 0, "total_revenue": 0, "period": "thisWeek", "startDate": "2026-02-09", "endDate": "2026-02-10" },
    "thisMonth": { "total_orders": 0, "total_revenue": 0, "period": "thisMonth", "startDate": "2026-02-01", "endDate": "2026-02-10" }
  }
}
```

### `GET /api/revenue/series`

Query:

- `startDate` 必填，`YYYY-MM-DD`
- `endDate` 必填，`YYYY-MM-DD`
- `bucket` 必填，`daily | weekly | monthly`
- `roomType` 可选

Response:

```json
{
  "message": "获取收入聚合序列成功",
  "data": [],
  "period": { "startDate": "2026-02-01", "endDate": "2026-02-10", "bucket": "daily", "roomType": null }
}
```

### `GET /api/revenue/room-type`

Query:

- `startDate` 必填，`YYYY-MM-DD`
- `endDate` 必填，`YYYY-MM-DD`

Response:

```json
{
  "message": "获取房型收入统计成功",
  "data": [],
  "period": { "startDate": "2026-02-01", "endDate": "2026-02-10", "type": "room-type" }
}
```

### `GET /api/revenue/daily-details`

Query:

- `startDate` 必填，`YYYY-MM-DD`
- `endDate` 必填，`YYYY-MM-DD`
- `roomType` 可选

Response:

```json
{
  "success": true,
  "data": [],
  "message": "获取每日营收明细成功，共 0 条记录"
}
```

### `GET /api/revenue/bills`

Query:

- `date` 可选，`YYYY-MM-DD`
- `roomNumber` 可选，精确匹配
- `orderId` 可选，模糊匹配
- `guestName` 可选，模糊匹配
- `payWay` 可选，精确匹配
- `changeType` 可选，精确匹配

Response:

```json
{
  "success": true,
  "data": []
}
```

## 依赖说明

- `../../database/postgreDB/pg`
- `decimal.js`
- `backend/modules/revenueModule.js` 仅作为旧导入路径兼容出口，实际实现已迁移到本模块 repository。

## 注意事项

- API 路径不能改。
- 请求和响应格式不能改。
- DATE 字段按 `YYYY-MM-DD` 字符串处理，不直接对业务 DATE 使用 `toISOString()`。
- 快速统计的本周、本月始终以数据库 `current_date` 为截止日；单日筛选只影响首卡。
