# 任务进度（收入统计：改为 orders 口径 + 明细默认日期）

> 规则：每完成一个流程步骤，我会同步更新本文件为“已完成”。

## 修改流程（待你确认后开始执行）

1. [x] 现状排查：确认收入统计页的 3 个数据源（顶部卡片/趋势图&每日营收明细/详细收入数据表）当前分别来自哪些接口与表
2. [x] 后端改造：将“快速统计（今日/本周/本月）”“趋势（按日/周/月）”“每日营收明细”统一改为基于 `orders` 表计算（`stay_date` 口径，排除 `status='cancelled'`）
3. [x] 后端保持：`详细收入数据` 继续使用 `bills` 表（不改口径）
4. [x] 前端微调：`详细收入数据` 的日期筛选默认值改为“当前日期”（保持页面布局不变）
5. [x] 编写测试样例：补充后端测试用例覆盖（快速统计 + 趋势按日 + 每日营收明细），并先让你确认用例设计
6. [x] 本地验证：运行相关测试，确认通过
7. [ ] 提交代码：你确认中文 commit message 后执行 `git add -A` 与 `git commit -m "..."`（中文）

## 当前进度记录

- 已排查：后端当前营收聚合（`backend/modules/revenueModule.js`）与 `/api/revenue/daily-details` 主要基于 `bills` 表的 `change_type='房费'`；本任务将改为 `orders.total_price` 按 `stay_date` 汇总（排除 `cancelled`）。
- 已排查：前端“详细收入数据”（`frontend/src/pages/Revenue/components/DetailedBillTable.vue`）默认日期为空，需要改为默认当天（`YYYY-MM-DD`）。
- 已完成：后端 `backend/modules/revenueModule.js` 的聚合口径已切换为 `orders`（快速统计/日周月趋势/所选范围汇总）。
- 已完成：后端 `/api/revenue/daily-details` 已切换为 `orders.total_price`（按 stay_date）。
- 已完成：前端 `frontend/src/pages/Revenue/composables/useDetailedBills.js` 默认日期已改为当天（`YYYY-MM-DD`），页面布局不变。
- 已完成：后端测试用例 `backend/tests/integration/revenue_statistics.test.js` 已按你确认的范围覆盖 2025-11-02~2025-11-09（含 11-04），并用 orders 聚合对账。
- 已完成验证：`cd backend && npm test -- integration/revenue_statistics.test.js` 通过。
- 已修复：收入统计页选择日期后自动刷新 quick-stats，单日选择时首卡会展示所选日期收入（`frontend/src/pages/Revenue/index.vue`）。

# 任务进度（数据适配：sql/orders.csv 拆分为“按天一行”）

> 规则：每完成一个流程步骤，我会同步更新本文件为“已完成”。

## 修改流程（待你确认后开始执行）

1. [x] 备份数据：复制 `sql/orders.csv` 为带时间戳的备份文件，保证可回滚（已生成 `sql/orders.csv.bak-20251221-165430`）
2. [x] 现状排查：已确认现 CSV 为“一单一行”，目标 orders 表为“按天一行”（新增 `stay_date`，`total_price` 为单日房费；`deposit/prepaid_amount` 通常只在首日记录；不再需要 `prepaid_at`）
3. [x] 转换策略：按“入住日含、退房日不含”拆分为每天一行；同日入住退房按 1 天处理（休息房）；`deposit/prepaid_amount` 仅首日保留，其余天置 0
4. [x] 金额校验：以“分”为单位做整除 + 余数分摊（前 N 天 +0.01），保证拆分后每日 `total_price` 之和严格等于原 `total_price`
5. [x] 生成新文件：已生成新的 `sql/orders.csv`（283 行含表头；原数据保留在 `sql/orders.csv.bak-20251221-165430`）
6. [x] 测试样例：已按你确认提供并实现测试（`sql/tools/test_split_orders_csv_daily.py`）
7. [x] 本地验证：已运行 `python3 sql/tools/test_split_orders_csv_daily.py` 通过
8. [x] 提交代码：已执行 `git add -A` 与 `git commit -m "数据适配：orders.csv 按天拆分并补充导入脚本"`
