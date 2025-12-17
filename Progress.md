# 修复进度（待确认）

## 背景
多日订单在「每日房间安排」中调整某一天的房间号后，原房间在该日期应为空闲，但「房间状态」页面仍显示占用。

## 目标
- 调整后，原房间在被调整的那一天显示为空闲；新房间显示占用。
- 「创建订单」可用房逻辑与「房间状态」占用逻辑保持一致。

## 状态
- [x] 0. 创建 `Progress.md`
- [x] 0. 确认修改流程

## 修改流程
- [x] 1. 复现并定位：锁定「房间状态」按日期查询走后端 `GET /api/rooms?date=YYYY-MM-DD`（`backend/modules/roomModule.js#getAllRooms`）
- [x] 2. 找到根因：按日期查询使用 `check_in_date/check_out_date` 范围过滤（而非 `stay_date`），导致同一订单其他日期的行仍命中，从而“旧房间”在该日未释放
- [x] 3. 实施修复：`GET /api/rooms?date=...` 改为按 `orders.stay_date = $1` 计算该日占用（`backend/modules/roomModule.js`）
- [x] 4. 编写测试样例（待确认）：新增 `backend/tests/room_status_day_room_change.test.js`，覆盖"多日订单 + 单日换房"后房态（旧房释放/新房占用）
- [x] 5. 执行测试：本地运行测试并确保通过

## 第二阶段修复（前端房间日历）
- [x] 6. 发现问题：后端测试通过但前端房间日历仍显示错误房态
- [x] 7. 分析根因：`useRoomCalendar.js` 使用聚合订单数据（`MAX(room_number)`）判断房间状态，没有使用每日明细数据
- [x] 8. 实施修复：修改 `useRoomCalendar.js`，使用后端每日房态 API（`/api/rooms?date=xxx`）获取精确到每一天的房间状态
- [x] 9. 前端测试：后端测试通过，前端代码已修改完成
- [ ] 10. 提交代码：使用中文 commit message 并执行 `git commit`

## 修复详情（第二阶段）
### 问题分析
前端 `useRoomCalendar.js` 原来的逻辑：
1. 从 `orderStore` 获取聚合订单数据
2. 使用订单的 `roomNumber`（`MAX(room_number)`）筛选
3. 使用 `checkInDate` 到 `checkOutDate` 日期范围判断状态

问题：当用户换房时，后端 `orders` 表的 `room_number` 已更新，但聚合查询返回的是 `MAX(room_number)`，不反映每日实际分配。

### 修复方案
修改 `frontend/src/pages/RoomStatus/composables/useRoomCalendar.js`：
- 使用后端每日房态 API（`/api/rooms?date=xxx`）
- 批量获取该月每一天的房间状态
- 精确到每一天判断房间是否被占用
