# shift-handover

## 模块职责

本模块服务前端“交接班”页面，负责当前班次汇总、交接班表格、特殊统计、管理员备忘录、历史交接记录和完成交接班保存。

## 业务边界

归属本模块：

- `/api/handover/*` 下交接班页面直接调用的接口。
- 交接班现金核对和四种支付方式的交接记录写入。
- 交接班页面使用的开房数、休息房数和好评邀/得统计。

不归属本模块：

- 收入统计报表：归 `income-statistics`。
- 房态状态流转：归 `room-status`。
- 好评邀请业务维护：归 `review`。
- 账单明细维护：归 `bill`。

## API 接口

### GET /api/handover/overview

请求参数：

```txt
date=YYYY-MM-DD
```

响应格式：

```json
{
  "success": true,
  "data": {
    "businessDate": "2025-11-02",
    "paymentData": {},
    "currentShift": {},
    "currentUser": {},
    "yesterdayRecord": {},
    "specialStats": {}
  }
}
```

### GET /api/handover/handover-table

请求参数：

```txt
date=YYYY-MM-DD
```

响应格式：

```json
{
  "success": true,
  "data": {}
}
```

### GET /api/handover/special-stats

请求参数：

```txt
date=YYYY-MM-DD
```

响应格式：

```json
{
  "success": true,
  "data": {
    "openCount": 0,
    "restCount": 0,
    "invited": 0,
    "positive": 0
  }
}
```

### GET /api/handover/admin-memos

请求参数：

```txt
date=YYYY-MM-DD
```

响应格式：

```json
{
  "success": true,
  "data": [],
  "message": "获取管理员备忘录成功"
}
```

### GET /api/handover/query

响应格式：

```json
{
  "success": true,
  "data": [
    {
      "date": "2025-11-02",
      "handoverPerson": "操作员",
      "takeoverPerson": "接班人",
      "vipCards": 0,
      "taskList": [],
      "remarks": "",
      "paymentCount": 4
    }
  ],
  "message": "成功查询到 1 条交接班记录"
}
```

### POST /api/handover/complete

请求体：

```json
{
  "date": "2025-11-02",
  "handoverPerson": "交班人",
  "receivePerson": "接班人",
  "retainedAmount": {
    "现金": 0,
    "微信": 0,
    "微邮付": 0,
    "其他": 0
  },
  "vipCard": 0,
  "notes": "备注"
}
```

响应格式：

```json
{
  "success": true,
  "message": "交接班完成，数据已保存",
  "data": {
    "date": "2025-11-02",
    "handoverPerson": "交班人",
    "receivePerson": "接班人",
    "recordCount": 4,
    "records": []
  }
}
```

## 当前阶段

Phase 3: routes/controller/validator/service/repository 已拆分。金额计算和部分已有交接班读取逻辑仍复用 `../handoverModule`，避免在本次迁移中改变金额口径、日期处理和历史兼容行为。

## 业务流程

- `GET /api/handover/overview` -> `shiftHandover.service.getOverview()` -> `handoverModule.getHandoverOverview()`
- `GET /api/handover/handover-table` -> `shiftHandover.service.getTableData()` -> `handoverModule.getHandoverTableData()`
- `GET /api/handover/special-stats` -> `shiftHandover.repository.getSpecialStats()`
- `GET /api/handover/admin-memos` -> `handoverModule.getAdminMemosFromHandover()`
- `GET /api/handover/query` -> `shiftHandover.repository.listCompletedHandoverRecords()`
- `POST /api/handover/complete` -> 后端重算交接表金额 -> `shiftHandover.repository.saveCompletedHandover()`

## 依赖说明

- `../handoverModule`: 保留既有交接班金额计算、表格读取和管理员备忘录兼容逻辑。
- `../../database/postgreDB/pg`: 查询和完成交接班事务写入。

## 注意事项

- API 路径不能改。
- 请求和响应格式不能改。
- `date` 是 PostgreSQL `DATE` 字段，按 `YYYY-MM-DD` 字符串传递，不做 UTC 转换。
- 完成交接班仍由后端重新计算金额，前端只提交留存金额、接班人、会员卡和备注。
- 完成交接班写入四种支付方式必须保持同一个事务。
