# Progress

## 任务：前端复杂逻辑下沉到后端（前端只展示 + 简单交互）

### 修改流程
1. 扫描前端：列出包含复杂业务判断/金额计算/日期计算的文件，并标注“应下沉到后端”的逻辑点。
2. 你确认范围与优先级后：设计后端接口/返回字段（让前端直接渲染），并确认不违反 Node.js 日期/时区规范（不 `toISOString()` 返回给前端，不手动时区换算）。
3. 后端实现：把房费拆分、应收/退款建议、交接班汇总等计算统一放到后端（必要时新增接口或扩展现有接口返回值）。
4. 前端改造：删除/收敛计算逻辑与复杂判断，改为消费后端已计算好的字段；仅保留 UI 显示、输入校验、事件触发。
5. 编写测试样例（优先后端测试）：覆盖价格拆分、退款建议、账单汇总等关键计算；把测试样例发你确认。
6. 你确认测试样例后：运行测试并修复与本任务相关的问题。
7. 你确认可以提交后：执行 `git add -A`，用中文 commit message `git commit -m "..."` 提交。

### 当前状态
- [x] 1) 扫描前端并列出复杂逻辑文件
- [x] 2) 你确认范围/优先级 + 后端接口设计（已确认）
  - 订单列表接口 `GET /api/orders`：后端补充计算字段，前端直接渲染
    - `stay_days`（已存在聚合字段）
    - `stay_dates`（已存在聚合字段）
    - `daily_prices`（新增：按 `stay_date -> total_price` 的对象，供前端展示“每日房费明细”）
    - `is_rest_room`（新增：是否休息房）
    - `remaining_room_fee`（新增：`max(total_price - prepaid_amount, 0)`）
  - 提前退房推荐接口 `GET /api/orders/:orderNumber/early-checkout/recommendation`（新增）
    - 入参：`actualCheckoutTime`（字符串，支持 `YYYY-MM-DDTHH:mm` / `YYYY-MM-DD`），`hasStayed`
    - 返回：`originalCheckoutDate`、`actualCheckoutDate`、`refundableNights[]`、`recommendedRefund`
  - 后端日期/时区规范：后端不再使用 `toISOString()`；不对 timestamptz 手动加减小时；尽量让数据库 `now()`/类型转换处理
- [x] 3) 后端实现下沉逻辑
  - `GET /api/orders` 聚合结果新增：`daily_prices` / `is_rest_room` / `remaining_room_fee`（供前端直接渲染）
  - 新增：`GET /api/orders/:orderNumber/early-checkout/recommendation`（后端统一计算可退房晚与推荐退款）
  - 后端账单写入：尽量使用数据库 `now()`/类型转换，避免 `toISOString()`/手动时区换算
- [ ] 4) 前端删减逻辑并对接新接口（进行中）
  - 提前退房弹窗：前端不再计算推荐退款，改为调用后端推荐接口
  - 入住确认弹窗：前端不再拆分房费/计算住宿天数，改为使用后端聚合字段（`daily_prices`/`stay_days`/`remaining_room_fee` 等）
  - 交接班核对：后端 `/bills/by-date/:date` 增加 `summaryDataObject`，前端优先直接使用后端汇总
  - 创建订单定价：新增后端 `POST /api/orders/pricing/breakdown`，前端不再做 Decimal 拆分/休息房半价逻辑
  - 订单详情财务信息：前端改为调用后端 `GET /api/orders/:order_id/deposit-info`（后端返回 `refundRecords/totalRoomFee`），不再从账单列表自行计算
- [x] 5) 编写测试样例并请求确认（已确认）
  - 新增后端 Jest 用例：`backend/tests/pricing_breakdown.test.js`（覆盖创建订单定价拆分接口）
- [x] 6) 运行测试并完成验证
  - 后端：`cd backend && npm test`（已全部通过：`18 passed, 108 passed`）
- [x] 7) `git add -A` + 中文 commit 提交
