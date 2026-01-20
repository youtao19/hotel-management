# Progress

> 说明：每完成一个步骤，我会同步更新本文件的状态为 ✅，并在开始代码修改前先查看本文件进度继续执行。

## 当前任务：重构 E2E 订单管理测试文件结构

### 1. 修改流程

- [x] 1) 创建 `backend/tests/e2e/order-management/` 文件夹 ✅
- [x] 2) 创建新的 spec 文件并内联所需函数（取消 helpers 依赖）：
  - `order-management/checkin.spec.js` ✅
  - `order-management/cancel.spec.js` ✅
  - `order-management/early-checkout.spec.js` ✅
  - `order-management/extend-stay.spec.js` ✅
  - `order-management/refund-deposit.spec.js` ✅
  - `order-management/search.spec.js` ✅
- [x] 3) 删除旧文件：
  - `order-checkin.spec.js` ✅
  - `order-management.cancel.spec.js` ✅
  - `order-management.early-checkout.spec.js` ✅
  - `order-management.extend-stay.spec.js` ✅
  - `order-management.refund-deposit.spec.js` ✅
  - `order-management.search.spec.js` ✅
- [x] 4) 删除 `helpers/orderManagement.e2e.helper.js` 和 `helpers/` 文件夹 ✅
- [x] 5) 保留 `login.spec.js` 在原位置 ✅
- [x] 6) 修复 `selectRoomTypeAndNumber` 函数的问题：
  - 修复菜单打开/关闭逻辑：等待菜单渲染后再获取选项数量 ✅
  - 修复菜单关闭等待：选择房型后等待菜单关闭再打开房号菜单 ✅
  - 修复房号正则匹配：支持 "116 (醉山塘)" 格式（不是纯数字） ✅
- [ ] 7) 运行测试验证：`npx playwright test tests/e2e/order-management/ --project=chromium`
- [ ] 8) 确认测试通过后提交代码

### 2. 当前状态

- 当前步骤：等待用户运行测试验证
- `checkin.spec.js` 的 3 个测试已通过 ✅

---

## 历史任务（已完成）

### 房间状态展示逻辑修复

- [x] 1) 阅读 `业务说明.md`，确认业务规则（不修改该文件）
- [x] 2) 定位「房间状态页面」展示逻辑：后端 SQL 计算 `display_status`，前端仅渲染该字段
- [x] 3) 明确问题与期望：若为"清理中/待清理"的房间分配了订单，则视为已完成清理，应自动进入"待入住"状态（无需手动点"完成清洁"）
- [x] 4) 实施修复：调整后端 `display_status` 计算优先级（订单状态优先于清扫状态）
- [x] 5) 修改 `backend/modules/roomModule.js` 中 getAllRooms 和 getRoomStatusRange 函数的 SQL 逻辑
- [x] 6) 修改测试用例 `backend/tests/room_display_status_api.test.js` 的预期结果
- [x] 7) 运行测试：`npm test -- room_display_status_api.test.js` ✅ 所有测试通过（5个测试）
- [x] 8) 确认测试通过后提交代码
