# 房态来源后端化（任务1&2）进度

## 目标回顾
- 任务1：房间卡片最终显示状态 **直接来自后端 SQL 查询**，状态优先级也在后端完成；前端只按返回状态渲染（不再做复杂判断）。
- 任务2：日历弹窗（按天）数据也由后端 API 按时间段返回；前端直接渲染。

## 约束（必须遵守）
- Node.js 后端对 `DATE` 字段：禁止 `new Date(date)` / `toISOString()`；以字符串传递/使用，或仅用于展示格式化。
- `timestamptz`：不手动加减时区，不用 `toISOString()` 直接返回给前端。
- 逻辑集中到后端：完成后删除前端与房态/日历相关的推导逻辑，前端仅做最小映射与渲染，保持代码整洁。

## 修改流程（需要你先确认）
- [x] 1. 更新 `Progress.md`：列出修改流程（本步骤）
- [x] 2. 等待你确认本流程（未确认前不改代码）
- [x] 2.1 修复当前报错：`RoomCalendarDialog.vue` 中 `<q-date>` 组件解析冲突导致的 Vue warn
- [x] 3. 任务1-后端：实现“单日房态”SQL（含优先级）并提供/调整 API 返回 `display_status`
- [x] 4. 任务1-前端：房间卡片改为直接使用后端 `display_status` 渲染（保持现有布局样式）
- [x] 4.1 清理前端：删除 `roomStore`/页面内与房态推导相关的代码（映射、归一化、根据订单计算 displayStatus 等）
- [x] 5. 任务2-后端：实现“时间段房态（日历）”API（传入 startDate/endDate/roomNumber）
- [x] 6. 任务2-前端：日历弹窗改用时间段 API，一次请求拿到当月每日房态直接渲染
- [x] 6.1 清理前端：删除日历按天循环请求与本地判断逻辑，仅保留渲染所需最小代码
- [x] 6.2 修复日历每天房态颜色不显示（QDate events/mask 格式兼容）
- [x] 7. 编写测试样例（你确认后再写）
- [x] 8. 执行测试并通过
- [x] 9. 提交代码：`git add .` + `git commit -m "中文commit message"`

## 设计草案（确认后按此落地）
### 任务1：单日房态（Room Card）
- 后端将以 `rooms` 为主表，按传入 `date (YYYY-MM-DD)` 查询 `orders.stay_date = date` 的订单。
- SQL 内完成状态优先级（示例）：
  1) `rooms.status = 'repair'`（或 `is_closed=true`）优先返回 `repair`
  2) `rooms.status = 'cleaning'` 优先返回 `cleaning`
  3) 若当日存在订单：`checked-in` > `pending` > `checked-out`
  4) 否则 `available`
- API 响应将包含：
  - `display_status`（前端直接用它渲染）
  - 以及必要的展示字段（如 `guest_name` / `check_in_date` / `check_out_date` / `order_id` 等）用于卡片信息展示

### 任务2：时间段房态（日历）
- 新增/扩展 API：传入 `roomNumber` + `startDate` + `endDate`（均为 `YYYY-MM-DD` 字符串）。
- 后端一次查询返回该房间在区间内每天的 `display_status`（以及需要展示的 `guest_name/order_id`）。
- 前端 `RoomCalendarDialog` 仅做：状态->颜色/文本 的简单映射，不再循环请求或推导订单逻辑。

---

请你先确认以上“修改流程 + 设计草案”是否OK（尤其是状态优先级规则是否符合你的业务预期）。确认后我再开始改代码。
