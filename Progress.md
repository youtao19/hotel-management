# 收入统计页修复/验证流程（待确认）

> 说明：每完成一步，会在本文件中把该步标记为【已完成】并补充结论/截图/关键日志位置（如有）。

## 1. 基线信息收集（未开始）
- [x] 【已完成】定位“交接班测试”使用的 SQL 数据文件/脚本与导入方式，并在本地数据库执行（或确认已存在）。
  - 已定位到测试数据脚本：`sql/orders.sql`、`sql/bills.sql`、`sql/rooms.sql`、`sql/room_types.sql`（现有集成测试 `backend/tests/integration/handover.test.js` 也使用这些脚本导入数据）。
  - 已通过 `npm test` 验证：测试环境会自动加载 `../.env.test` 并连接 `POSTGRES_TEST_DB`（测试全部通过，说明测试库连接正常）。
- [x] 【已完成】梳理收入统计页面使用的后端 API（路由、入参、出参字段），确认“今日/本周/本月收入”的口径（是否含退款、是否按入住/结账日等）。
  - 口径补充（已确认）：今日收入=今天入住日对应的“房费预期收入”，多日订单只算入住日期=今天那一晚的房费，不包含收押（押金）。
- [x] 【已完成】梳理“每日营收表”所依赖的 API/SQL，确认房型筛选逻辑与口径。
  - 收入统计页接口：`backend/routes/revenueRoute.js`（`/api/revenue/quick-stats`、`/api/revenue/overview`、`/api/revenue/daily|weekly|monthly` 等），主要逻辑在 `backend/modules/revenueModule.js`。
  - 每日营收明细接口：`GET /api/revenue/daily-details`（按 `bills.stay_date` 聚合每天实际房费，不做均分）。

## 2. 用交接班 SQL 数据做对账（未开始）
- [x] 【已完成】用交接班测试 SQL 数据对账：今日收入、本周收入、本月收入（以数据库为准），记录期望值。
  - 已新增对账用例：`backend/tests/integration/revenue_statistics.test.js`
  - 对账基准日：`2025-11-04`（用于模拟“今日”）
  - 期望值（房费预期收入，不含押金/收押，按 `bills.stay_date` 的每天实际房费累加）：
    - 今日收入（`2025-11-04`）：`total_revenue=3630.34`，`total_orders=31`
    - 本周收入（周一起始 `2025-11-03` ~ `2025-11-04`）：`total_revenue=6723.53`，`total_orders=55`
    - 本月收入（`2025-11-01` ~ `2025-11-04`）：`total_revenue=9710.47`，`total_orders=76`
- [x] 【已完成】对比 API 返回值与期望值，并覆盖房型筛选与每日营收明细校验。
  - 覆盖接口：`/api/revenue/overview`、`/api/revenue/daily`、`/api/revenue/quick-stats?baseDate=...`、`/api/revenue/daily-details`

## 3. 后端实现口径与逻辑（未开始）
- [x] 【已完成】把“今日/本周/本月收入”以及“每日营收表”的核心判断/聚合逻辑集中到后端（API 直接返回可展示数据）。
  - 收入口径统一：仅房费（`bills.change_type='房费'`），按 `bills.stay_date` 的每天实际房费累加，不包含押金/收押。
  - 相关实现：`backend/modules/revenueModule.js`
- [x] 【已完成】严格遵守日期/时区规范：`DATE` 字段按字符串使用；`timestamptz` 不手动加减 8 小时、不用 `toISOString()` 返回前端。
  - `quick-stats` 默认使用数据库 `current_date`，并支持 `baseDate=YYYY-MM-DD` 便于对账：`backend/routes/revenueRoute.js`
- [x] 【已完成】在关键逻辑处补充必要的中文注释（解释口径、边界条件）。

## 4. 前端清理（未开始）
- [x] 【已完成】删除收入统计页面中与后端重复的逻辑判断/二次计算代码，仅做展示与基础格式化。
  - 不再在前端补齐日维度空数据、也不再用 `toISOString()` 拼日期：`frontend/src/pages/Revenue/composables/useRevenueData.js`
- [x] 【已完成】确认随机选择一个房型后，“每日营收表”展示数据与后端返回一致（已通过对账测试覆盖）。

## 5. 测试样例与验收（未开始）
- [x] 【已完成】编写一个“测试样例”（包含：准备数据 SQL、调用 API/打开页面的步骤、期望结果），提交你确认。
  - 测试样例：`backend/tests/integration/revenue_statistics.test.js`
  - 运行方式：`npm test`（会自动导入交接班测试 SQL 数据并对账接口返回）
- [x] 【已完成】按确认后的样例完成测试并记录结果（必要时附关键接口返回）。
  - 已确认口径：周一起始；收入=按 `bills.stay_date` 的每日实际房费累加（仅 `change_type='房费'`，不含押金/收押）
  - 已运行结果：`npm test` 全部通过

## 6. 提交代码（未开始）
- [ ] 【未完成】使用中文撰写 commit message。
- [ ] 【未完成】执行 `git add -A` 与 `git commit -m "..."`。
