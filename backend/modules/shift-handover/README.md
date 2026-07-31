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

`date` 可省略；省略时后端按北京时间返回默认日期。上一营业日未完成时默认返回上一营业日，否则返回当天。响应中的 `displayDate` 为实际展示日期，`readOnly` 表示该日期是否只能查看。

已完成历史日期读取已保存交接数据；未完成历史日期的交接表金额为 0；当天和未来日期按所选日期实时计算但只读。

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
    "cashReserveSetting": {
      "configured": true,
      "amount": 320,
      "cashRetained": 320,
      "setBy": "操作员"
    },
    "isCompleted": false,
    "specialStats": {}
  }
}
```

### PUT /api/handover/daily-cash-reserve

按营业日期保存现金备用金与留存款。该表是两项金额的唯一来源；设置为 `0` 有效，未设置时不能完成交接，完成交接后不可修改。

请求体：

```json
{
  "date": "2025-11-02",
  "cashReserve": 320,
  "cashRetained": 320
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

### GET /api/handover/source-details

查询交接表中客房收入、休息房收入、租车收入、客房退押或休息房退押的来源账单。

请求参数：

```txt
date=YYYY-MM-DD&item=hotelIncome&paymentMethod=微信
```

`item` 可为 `hotelIncome`、`restIncome`、`carRentIncome`、`hotelRefundDeposit`、`restRefundDeposit`。

响应中的 `sourceMode` 为 `live`（当前交接实时账单）、`snapshot`（已完成交接快照）或 `reference`（旧历史记录的实时账单参考）。

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

## 内部结构

- `shiftHandover.routes.js`：HTTP 路由。
- `shiftHandover.controller.js`：请求解析和响应。
- `shiftHandover.validator.js`：AJV 参数校验。
- `shiftHandover.service.js`：页面汇总和完成交接班业务流程。
- `shiftHandover.repository.js`：PostgreSQL 查询和事务写入。
- `shiftHandover.calculator.js`：纯金额计算。
- `shiftHandover.businessRules.js`：营业日期、班次和默认备用金规则。

## 业务流程

- `GET /api/handover/overview` -> `shiftHandover.service.getOverview()` -> calculator/businessRules/repository 编排
- `GET /api/handover/handover-table` -> `shiftHandover.service.getTableData()` -> 有保存记录则映射、否则按 bills 计算
- `GET /api/handover/source-details` -> `shiftHandover.service.getSourceDetails()` -> 当前账单、交接快照或历史账单参考
- `GET /api/handover/special-stats` -> `shiftHandover.repository.getSpecialStats()`
- `GET /api/handover/admin-memos` -> `shiftHandover.service.getAdminMemos()` -> repository 读取并过滤 `type === "admin"`
- `POST /api/handover/complete` -> 后端重算交接表金额 -> `shiftHandover.repository.saveCompletedHandover()`
- `PUT /api/handover/daily-cash-reserve` -> 校验当天未完成交接 -> 保存 `handover_daily_settings` 中的现金备用金与留存款

## 数据口径

特殊统计当前存在两套 SQL 口径，本轮分别保留，未合并：

- overview 页面汇总统计：`shiftHandover.repository.getOverviewSpecialStats()`（用于 overview 汇总）。
- `/special-stats` 独立接口统计：`shiftHandover.repository.getSpecialStats()`。

不要宣称两者已经统一。

## 依赖说明

- `./shiftHandover.calculator`：纯金额计算（分计算、元返回、支付方式常量）。
- `./shiftHandover.businessRules`：营业日期、班次和非现金支付方式的默认备用金规则。
- `../../database/postgreDB/pg`: 查询和完成交接班事务写入。

## 注意事项

- API 路径不能改。
- 请求和响应格式不能改。
- `date` 是 PostgreSQL `DATE` 字段，按 `YYYY-MM-DD` 字符串传递，不做 UTC 转换。
- 完成交接班仍由后端重新计算金额，前端只提交留存金额、接班人、会员卡和备注。
- 现金备用金与留存款只能从 `handover_daily_settings` 读取，不再使用固定值或昨日交接款作为回退。
- 完成交接班写入四种支付方式必须保持同一个事务。
- 完成交接时同时保存来源账单快照，后续账单变动不得改变该交接记录的来源明细。
