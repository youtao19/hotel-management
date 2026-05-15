# 收入统计接口文档

更新时间：2026-02-11

> 模块实现位置：`backend/modules/income-statistics/README.md`。收入统计页面相关 API 已迁移到 `income-statistics` 模块，本文件保留为全局索引和对外说明。

## 1. 获取快速统计（今日/本周/本月）

- Method: `GET`
- Path: `/api/revenue/quick-stats`
- Query:
  - `baseDate`（可选，`YYYY-MM-DD`）
  - `startDate`（可选，`YYYY-MM-DD`）
  - `endDate`（可选，`YYYY-MM-DD`）

### 收入口径（已更新）

- 订单房费收入：`orders.total_price`，按 `orders.stay_date` 计入，排除 `status='cancelled'`。
- 订单补收收入：`bills.change_type='补收'` 且金额大于 0，按 `DATE(bills.create_time)` 计入。
- 租车收入：`bills.stay_type='租车收入'` 且金额大于 0，按 `DATE(bills.create_time)` 计入。

### 说明

- 当且仅当 `startDate === endDate` 时，`today` 卡片展示该单日收入。
- `thisWeek`、`thisMonth` 始终以数据库 `current_date` 为截止日。

---

## 2. 获取收入趋势序列

- Method: `GET`
- Path: `/api/revenue/series`
- Query:
  - `startDate`（必填，`YYYY-MM-DD`）
  - `endDate`（必填，`YYYY-MM-DD`）
  - `bucket`（必填，`daily | weekly | monthly`）
  - `roomType`（可选）

### 收入口径（已更新）

- 与 `/api/revenue/quick-stats` 完全一致：订单房费 + 补收 + 租车收入。
- `roomType` 过滤仅作用于可归属房型的收入（租车收入无房型归属，筛选房型时不计入）。

---

## 3. 获取房型收入统计

- Method: `GET`
- Path: `/api/revenue/room-type`
- Query:
  - `startDate`（必填，`YYYY-MM-DD`）
  - `endDate`（必填，`YYYY-MM-DD`）

### 收入口径（已更新）

- 统计房型可归属收入：
  - `orders.total_price`（按 `stay_date`）
  - `bills.change_type='补收'`（按 `DATE(create_time)`，归属到订单房型）
- 租车收入不归属具体房型，不进入该接口返回。

---

## 4. 获取每日营收明细

- Method: `GET`
- Path: `/api/revenue/daily-details`
- Query:
  - `startDate`（必填，`YYYY-MM-DD`）
  - `endDate`（必填，`YYYY-MM-DD`）
  - `roomType`（可选）

### 收入口径（已更新）

- 明细统一展示三类收入：
  - 订单房费：`orders.total_price`（按 `stay_date`）
  - 订单补收：`bills.change_type='补收'`（按 `DATE(create_time)`）
  - 租车收入：`bills.stay_type='租车收入'`（按 `DATE(create_time)`）
- 退款/退押等负向账单不会进入该明细。

---

## 5. 获取详细收入账单（详细收入数据表）

- Method: `GET`
- Path: `/api/revenue/bills`
- Query（均可选）：
  - `date`：单日过滤（`YYYY-MM-DD`，按 `DATE(create_time)`）
  - `roomNumber`：房号（精确匹配）
  - `orderId`：订单号（模糊匹配）
  - `guestName`：客人名（模糊匹配）
  - `payWay`：支付方式（精确匹配）
  - `changeType`：账单类型（精确匹配）

### 说明

- 返回结果默认按 `DATE(create_time) DESC, room_number DESC, bill_id DESC` 排序。
