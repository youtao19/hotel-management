# 交接班遗留模块拆分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `backend/modules/handoverModule.js` 中仍被当前交接班页面使用的逻辑迁入 `backend/modules/shift-handover/`，删除无调用的旧流程，最终删除 `handoverModule.js`，并保持现有 API、金额、日期和数据库行为不变。

**Architecture:** 纯金额计算放入 `shiftHandover.calculator.js`，营业日期和班次规则放入 `shiftHandover.businessRules.js`，所有 SQL 放入现有 `shiftHandover.repository.js`，页面汇总和完成交接班流程由现有 `shiftHandover.service.js` 编排。迁移采用 characterization tests 先锁定现状，再逐个切换调用；特殊统计当前存在两种口径，本轮分别保留并明确命名，不在结构重构中合并业务规则。

**Tech Stack:** Node.js、Express、PostgreSQL、Jest、Supertest、AJV

---

## 成功标准

- [x] `backend/modules/shift-handover/` 不再引用 `../handoverModule`。
- [x] `backend/modules/handoverModule.js` 被删除。
- [x] `/api/handover/overview`、`/handover-table`、`/special-stats`、`/admin-memos`、`/query`、`/complete` 的路径和响应结构不变。
- [x] `DATE` 继续使用 `YYYY-MM-DD` 字符串，不使用 `toISOString()`，不手动做 UTC 或小时换算。
- [x] 金额继续按分计算并保留两位小数；现金默认留存 320 元、支付方式映射和兼容字段不变。
- [x] 完成交接班仍在一个数据库事务内写入四种支付方式。
- [x] 确认无调用的旧导出全部删除。
- [x] 聚焦测试、后端全量测试、语法检查和 `git diff --check` 全部通过。

## 文件规划

**新增文件**

- `backend/modules/shift-handover/shiftHandover.calculator.js`
  - 支付方式常量、金额转分、分转金额、桶初始化、金额标准化和交接金额重算。
- `backend/modules/shift-handover/shiftHandover.businessRules.js`
  - 前一天日期、当前班次、当前用户展示信息、默认备用金规则。
- `backend/modules/shift-handover/__tests__/shiftHandover.calculator.test.js`
  - 锁定金额精度、退款、留存和兼容字段行为。
- `backend/modules/shift-handover/__tests__/shiftHandover.businessRules.test.js`
  - 锁定 DATE 字符串和班次边界。
- `backend/modules/shift-handover/__tests__/shiftHandover.service.test.js`
  - mock repository，验证 overview 与 complete 的业务编排。

**修改文件**

- `backend/modules/shift-handover/shiftHandover.repository.js`
  - 接收旧文件中的账单、备用金、已保存表格、昨日状态、页面统计和管理员备忘录查询。
- `backend/modules/shift-handover/shiftHandover.service.js`
  - 移除 `handoverModule` 依赖，改用 calculator、businessRules 和 repository。
- `backend/tests/integration/handover.test.js`
  - 增加保存前后表格、管理员备忘录、日期和统计口径回归测试。
- `backend/modules/shift-handover/README.md`
  - 更新模块内部结构、数据口径和依赖说明。
- `.ai/tasks/refactor-shift-handover/TASKS.md`
  - 增加 Phase 4，并记录每个迁移步骤的完成状态。

**删除文件**

- `backend/modules/handoverModule.js`

---

### Task 1: 用测试锁定当前公开行为

**Files:**
- Modify: `backend/tests/integration/handover.test.js`

- [x] **Step 1: 增加无已保存记录时的表格回归测试**

在现有 `describe` 中增加测试，锁定从 `bills` 计算的字段和兼容别名：

```javascript
test("handover-table 没有已保存记录时，应返回计算结果和兼容字段", async () => {
  const response = await request(app)
    .get("/api/handover/handover-table")
    .query({ date: "2025-11-02" });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data).toEqual(expect.objectContaining({
    reserve: expect.any(Object),
    hotelIncome: expect.any(Object),
    restIncome: expect.any(Object),
    hotelDeposit: expect.any(Object),
    restDeposit: expect.any(Object),
    hotelRefund: expect.any(Object),
    restRefund: expect.any(Object),
    hotelRefundDeposit: expect.any(Object),
    restRefundDeposit: expect.any(Object),
    retainedAmount: expect.any(Object),
    handoverAmount: expect.any(Object)
  }));
  expect(response.body.data.hotelRefund).toEqual(response.body.data.hotelDeposit);
  expect(response.body.data.restRefund).toEqual(response.body.data.restDeposit);
});
```

- [x] **Step 2: 增加保存后读取表格的回归测试**

在调用 `/complete` 后请求 `/handover-table`，断言人员、会员卡、备注和四类金额仍可读取：

```javascript
const tableResponse = await request(app)
  .get("/api/handover/handover-table")
  .query({ date: "2025-11-02" });

expect(tableResponse.status).toBe(200);
expect(tableResponse.body.data).toEqual(expect.objectContaining({
  vipCards: 6,
  takeoverPerson: "peach",
  remarks: "新版单页交接完成"
}));
expect(tableResponse.body.data.retainedAmount["现金"]).toBe(320);
```

- [x] **Step 3: 锁定 overview 与 special-stats 当前各自的响应结构**

不要先断言两者数字相同，因为当前 SQL 口径不同。只锁定字段和数值类型：

```javascript
const overview = await request(app)
  .get("/api/handover/overview")
  .query({ date: "2025-11-02" });
const stats = await request(app)
  .get("/api/handover/special-stats")
  .query({ date: "2025-11-02" });

for (const payload of [overview.body.data.specialStats, stats.body.data]) {
  expect(payload).toEqual({
    openCount: expect.any(Number),
    restCount: expect.any(Number),
    invited: expect.any(Number),
    positive: expect.any(Number)
  });
}
```

- [x] **Step 4: 运行测试确认基线通过**

Run:

```bash
npm --workspace backend run test -- tests/integration/handover.test.js
```

Expected: PASS。若失败，先修正测试夹具，不修改业务实现。

- [x] **Step 5: 提交测试基线**

```bash
git add backend/tests/integration/handover.test.js
git commit -m "test: 补充交接班模块拆分回归测试"
```

---

### Task 2: 提取纯金额计算

**Files:**
- Create: `backend/modules/shift-handover/shiftHandover.calculator.js`
- Create: `backend/modules/shift-handover/__tests__/shiftHandover.calculator.test.js`
- Modify: `backend/modules/shift-handover/shiftHandover.service.js`
- Modify: `backend/modules/handoverModule.js`

- [x] **Step 1: 为金额计算编写失败测试**

覆盖浮点精度、非法值归零、退款和留存：

```javascript
const calculator = require("../shiftHandover.calculator");

test("按支付方式重算交接金额并保持两位小数", () => {
  const result = calculator.recalculatePaymentData({
    reserve: { "现金": 320, "微信": 0, "微邮付": 0, "其他": 0 },
    hotelIncome: { "现金": 100.1, "微信": 20.2, "微邮付": 0, "其他": 0 },
    restIncome: { "现金": 0.2, "微信": 0, "微邮付": 0, "其他": 0 },
    carRentIncome: {},
    hotelDeposit: { "现金": 50, "微信": 0, "微邮付": 0, "其他": 0 },
    restDeposit: {},
    retainedAmount: { "现金": 320, "微信": 0, "微邮付": 0, "其他": 0 }
  });

  expect(result.totalIncome["现金"]).toBe(420.3);
  expect(result.totalRefundDeposit["现金"]).toBe(50);
  expect(result.handoverAmount["现金"]).toBe(50.3);
  expect(result.hotelRefundDeposit).toEqual(result.hotelDeposit);
});
```

- [x] **Step 2: 运行测试确认文件尚不存在**

Run:

```bash
npm --workspace backend run test -- modules/shift-handover/__tests__/shiftHandover.calculator.test.js
```

Expected: FAIL，错误为无法找到 `shiftHandover.calculator`。

- [x] **Step 3: 移动纯函数并导出稳定接口**

从旧文件移动以下内容，不改变实现：

```javascript
"use strict";

const PAYMENT_METHODS = ["现金", "微信", "微邮付", "其他"];

function createPaymentBuckets() {
  return PAYMENT_METHODS.reduce((result, method) => {
    result[method] = 0;
    return result;
  }, {});
}

function amountToCents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function centsToAmount(cents) {
  return Number((cents / 100).toFixed(2));
}

function normalizeAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}
```

同时迁移 `convertBucketsToAmounts`、`convertBucketsToCents`、`normalizePaymentBucket` 和 `recalculatePaymentData`。统一使用 `PAYMENT_METHODS`，不要在多个文件重复支付方式数组。

- [x] **Step 4: 将新 service 切换到 calculator**

```javascript
const calculator = require("./shiftHandover.calculator");

const paymentData = calculator.recalculatePaymentData(
  overview.paymentData,
  { retainedAmount }
);
```

旧文件临时从 calculator 导入这些函数，保证后续迁移期间行为一致：

```javascript
const {
  PAYMENT_METHODS,
  amountToCents,
  convertBucketsToAmounts,
  convertBucketsToCents,
  createPaymentBuckets,
  normalizeAmount,
  recalculatePaymentData
} = require("./shift-handover/shiftHandover.calculator");
```

- [x] **Step 5: 运行单元和集成测试**

```bash
npm --workspace backend run test -- \
  modules/shift-handover/__tests__/shiftHandover.calculator.test.js \
  tests/integration/handover.test.js
```

Expected: PASS。

- [x] **Step 6: 提交金额计算拆分**

```bash
git add backend/modules/handoverModule.js \
  backend/modules/shift-handover/shiftHandover.calculator.js \
  backend/modules/shift-handover/shiftHandover.service.js \
  backend/modules/shift-handover/__tests__/shiftHandover.calculator.test.js
git commit -m "refactor: 提取交接班金额计算"
```

---

### Task 3: 提取营业日期、班次和默认备用金规则

**Files:**
- Create: `backend/modules/shift-handover/shiftHandover.businessRules.js`
- Create: `backend/modules/shift-handover/__tests__/shiftHandover.businessRules.test.js`
- Modify: `backend/modules/handoverModule.js`

- [x] **Step 1: 编写日期和班次边界测试**

```javascript
const rules = require("../shiftHandover.businessRules");

test.each([
  ["2026-01-01", "2025-12-31"],
  ["2026-03-01", "2026-02-28"],
  ["2024-03-01", "2024-02-29"]
])("前一天日期保持 YYYY-MM-DD 字符串", (date, expected) => {
  expect(rules.getPreviousBusinessDate(date)).toBe(expected);
});

test.each([
  [new Date(2026, 5, 12, 7, 59), "night"],
  [new Date(2026, 5, 12, 8, 0), "morning"],
  [new Date(2026, 5, 12, 16, 0), "evening"]
])("按本地时间判断班次", (now, expectedCode) => {
  expect(rules.resolveCurrentShift(now).code).toBe(expectedCode);
});
```

- [x] **Step 2: 运行测试确认失败**

```bash
npm --workspace backend run test -- modules/shift-handover/__tests__/shiftHandover.businessRules.test.js
```

Expected: FAIL，文件尚不存在。

- [x] **Step 3: 提取领域规则**

```javascript
"use strict";

function getPreviousBusinessDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function buildReserveDefaults({ isComplete, handoverAmounts }) {
  return {
    "现金": 320,
    "微信": isComplete ? handoverAmounts["微信"] : 0,
    "微邮付": 0,
    "其他": 0
  };
}
```

同时移动 `resolveCurrentShift` 和 `resolveCurrentUser`。禁止改为 `toISOString()`。

- [x] **Step 4: 旧文件临时改为调用新规则**

将 `getPreviousDateString` 替换为 `getPreviousBusinessDate`，将昨日状态中的 `reserveDefaults` 改为调用 `buildReserveDefaults`。

- [x] **Step 5: 运行测试**

```bash
npm --workspace backend run test -- \
  modules/shift-handover/__tests__/shiftHandover.businessRules.test.js \
  tests/integration/handover.test.js
```

Expected: PASS。

- [x] **Step 6: 提交领域规则拆分**

```bash
git add backend/modules/handoverModule.js \
  backend/modules/shift-handover/shiftHandover.businessRules.js \
  backend/modules/shift-handover/__tests__/shiftHandover.businessRules.test.js
git commit -m "refactor: 提取交接班日期和班次规则"
```

---

### Task 4: 将当前页面读取 SQL 迁入 repository

**Files:**
- Modify: `backend/modules/shift-handover/shiftHandover.repository.js`
- Modify: `backend/modules/handoverModule.js`
- Modify: `backend/tests/integration/handover.test.js`

- [x] **Step 1: 为 repository 定义明确的数据访问接口**

新增以下 repository 接口，每个接口只负责 SQL 和数据库行转换：

- `findBillsByBusinessDate(date): Promise<Array>`
- `findHandoverRowsByDate(date): Promise<Array>`
- `findReserveByDate(date): Promise<Object|null>`
- `findPreviousHandoverSummary(date): Promise<Object>`
- `findAdminMemoTasks(date): Promise<Array>`
- `getOverviewSpecialStats(date): Promise<Object>`

`getOverviewSpecialStats` 迁移旧 `getShiftSpecialStats` 的 SQL，保留其错误时返回四个 0 的行为。现有 `getSpecialStats` 保留当前 `/special-stats` SQL，不能互相替换。

- [x] **Step 2: 迁移账单读取 SQL**

```javascript
async function findBillsByBusinessDate(date) {
  const sql = `
    SELECT bill_id, order_id, pay_way, change_price, change_type, stay_type, stay_date
    FROM bills
    WHERE stay_date::date = $1::date
    ORDER BY bill_id ASC
  `;
  const result = await query(sql, [date]);
  return result.rows;
}
```

- [x] **Step 3: 迁移已保存交接记录和昨日状态 SQL**

repository 返回数据库事实，不在其中决定默认现金 320 元，也不判断班次。DATE 列继续在 SQL 中使用 `date::text` 或参数 `$1::date`。

- [x] **Step 4: 迁移管理员备忘录读取**

保留 JSONB 已经可能是数组、也可能是字符串的兼容处理，但将“只返回 `type === "admin"`”放在 service。

- [x] **Step 5: 旧文件改为调用 repository**

此阶段只替换 SQL 来源，不改变旧函数签名和响应结构。

- [x] **Step 6: 运行集成测试**

```bash
npm --workspace backend run test -- tests/integration/handover.test.js
```

Expected: PASS。

- [x] **Step 7: 提交读取层迁移**

```bash
git add backend/modules/handoverModule.js \
  backend/modules/shift-handover/shiftHandover.repository.js \
  backend/tests/integration/handover.test.js
git commit -m "refactor: 迁移交接班读取查询"
```

---

### Task 5: 将表格计算和 overview 编排迁入 service

**Files:**
- Create: `backend/modules/shift-handover/__tests__/shiftHandover.service.test.js`
- Modify: `backend/modules/shift-handover/shiftHandover.service.js`
- Modify: `backend/modules/handoverModule.js`

- [x] **Step 1: mock repository 编写 service 失败测试**

```javascript
jest.mock("../shiftHandover.repository", () => ({
  findBillsByBusinessDate: jest.fn(),
  findPreviousHandoverSummary: jest.fn(),
  findReserveByDate: jest.fn(),
  getOverviewSpecialStats: jest.fn()
}));

test("overview 使用昨日完整记录生成默认备用金", async () => {
  repository.findPreviousHandoverSummary.mockResolvedValue({
    hasRecord: true,
    isComplete: true,
    paymentCount: 4,
    paymentTypes: [1, 2, 3, 4],
    handoverPerson: "A",
    takeoverPerson: "B",
    handoverAmounts: {
      "现金": 100,
      "微信": 200,
      "微邮付": 300,
      "其他": 400
    }
  });
  repository.findBillsByBusinessDate.mockResolvedValue([]);
  repository.getOverviewSpecialStats.mockResolvedValue({
    openCount: 0,
    restCount: 0,
    invited: 0,
    positive: 0
  });

  const result = await service.getOverview({
    date: "2026-06-12",
    account: { username: "peach" }
  });

  expect(result.yesterdayRecord.date).toBe("2026-06-11");
  expect(result.paymentData.reserve).toEqual({
    "现金": 320,
    "微信": 200,
    "微邮付": 0,
    "其他": 0
  });
});
```

- [x] **Step 2: 运行测试确认 service 仍依赖旧文件**

```bash
npm --workspace backend run test -- modules/shift-handover/__tests__/shiftHandover.service.test.js
```

Expected: FAIL，service 尚未使用新的 repository 接口。

- [x] **Step 3: 将 `getShiftTable` 改造成 service 内部计算函数**

拆为三个小函数：

- `mapBillPaymentMethod(payWay)`：将现金、微信、微邮付映射到同名支付方式，平台和未知值映射到其他。
- `aggregateBills(rows, reserve)`：按账单类型和入住类型累计以分为单位的金额桶。
- `buildCalculatedPaymentData(date)`：读取前一日备用金和当日账单，返回前端使用的金额结构与兼容别名。

保持以下规则：

- `平台` 和未知支付方式归入 `其他`。
- `房费`、`收押`、旧格式 `订单账单` 计入收入。
- `退押` 取绝对值后计入退款。
- 计算全程使用分，返回时转换为元。
- 默认现金留存 320 元。
- 保留 `hotelRefund`、`restRefund`、`hotelRefundDeposit`、`restRefundDeposit` 别名。

- [x] **Step 4: 将 `getHandoverTableData` 迁入 service**

```javascript
async function getTableData(date) {
  const rows = await repository.findHandoverRowsByDate(date);
  if (rows.length === 0) {
    return buildCalculatedPaymentData(date);
  }
  return mapSavedHandoverRows(rows);
}
```

- [x] **Step 5: 将昨日状态和 overview 迁入 service**

`getOverview` 并行获取计算表格和 overview 专用统计，然后调用 businessRules 构建班次、用户和备用金。

- [x] **Step 6: 切断 service 对旧文件的依赖**

删除：

```javascript
const handoverModule = require("../handoverModule");
```

改为只依赖：

```javascript
const calculator = require("./shiftHandover.calculator");
const businessRules = require("./shiftHandover.businessRules");
const repository = require("./shiftHandover.repository");
```

- [x] **Step 7: 运行单元和集成测试**

```bash
npm --workspace backend run test -- \
  modules/shift-handover/__tests__/shiftHandover.service.test.js \
  modules/shift-handover/__tests__/shiftHandover.calculator.test.js \
  modules/shift-handover/__tests__/shiftHandover.businessRules.test.js \
  tests/integration/handover.test.js
```

Expected: PASS。

- [x] **Step 8: 提交 service 迁移**

```bash
git add backend/modules/handoverModule.js backend/modules/shift-handover
git commit -m "refactor: 迁移交接班页面业务编排"
```

---

### Task 6: 迁移管理员备忘录并清点旧流程

**Files:**
- Modify: `backend/modules/shift-handover/shiftHandover.service.js`
- Modify: `backend/modules/shift-handover/shiftHandover.repository.js`
- Modify: `backend/tests/integration/handover.test.js`

- [x] **Step 1: 增加管理员备忘录接口测试**

直接插入现金交接记录和 `task_list`：

```javascript
await query(
  `INSERT INTO handover (
    date, payment_type, task_list, handover_person, takeover_person
  ) VALUES ($1::date, 1, $2::jsonb, '', '')`,
  [
    "2025-11-02",
    JSON.stringify([
      { id: 1, title: "管理员事项", type: "admin", completed: false },
      { id: 2, title: "普通事项", type: "normal", completed: false }
    ])
  ]
);

const response = await request(app)
  .get("/api/handover/admin-memos")
  .query({ date: "2025-11-02" });

expect(response.body.data).toEqual([
  expect.objectContaining({ title: "管理员事项", type: "admin" })
]);
```

- [x] **Step 2: service 过滤管理员任务**

```javascript
async function getAdminMemos(date) {
  const tasks = await repository.findAdminMemoTasks(date);
  return tasks.filter((task) => task.type === "admin");
}
```

repository 查询失败时仍返回空数组，保持页面不因备忘录失败而不可用。

- [x] **Step 3: 全仓库确认旧导出没有调用者**

Run:

```bash
rg -n "getShiftTable|getRemarks|getAvailableDates|getAvailableDatesFlexible|startHandover|getReserveCash|getShiftSpecialStats|getPreviousHandoverStatus|checkYesterdayHandoverRecord|saveAdminMemoToHandover|getAdminMemosFromHandover|handoverModule" \
  backend frontend e2e docs \
  --glob '!backend/modules/handoverModule.js'
```

Expected:

- 业务代码中没有 `handoverModule` 引用。
- 旧导出没有调用者。
- 文档只允许出现“已删除旧模块”的迁移说明。

- [x] **Step 4: 运行测试**

```bash
npm --workspace backend run test -- tests/integration/handover.test.js
```

Expected: PASS。

- [x] **Step 5: 提交备忘录迁移**

```bash
git add backend/modules/shift-handover backend/tests/integration/handover.test.js
git commit -m "refactor: 迁移交接班备忘录读取"
```

---

### Task 7: 删除 `handoverModule.js`

**Files:**
- Delete: `backend/modules/handoverModule.js`
- Modify: `backend/modules/shift-handover/README.md`
- Modify: `docs/ONBOARDING.md`
- Modify: `.ai/tasks/refactor-shift-handover/TASKS.md`

- [x] **Step 1: 删除旧文件**

```bash
git rm backend/modules/handoverModule.js
```

- [x] **Step 2: 更新模块 README**

删除“仍复用 `../handoverModule`”的阶段性说明，写明：

```markdown
## 内部结构

- `shiftHandover.routes.js`：HTTP 路由。
- `shiftHandover.controller.js`：请求解析和响应。
- `shiftHandover.validator.js`：AJV 参数校验。
- `shiftHandover.service.js`：页面汇总和完成交接班业务流程。
- `shiftHandover.repository.js`：PostgreSQL 查询和事务写入。
- `shiftHandover.calculator.js`：纯金额计算。
- `shiftHandover.businessRules.js`：营业日期、班次和默认备用金规则。
```

同时明确两套特殊统计口径当前分别服务：

- overview 页面汇总统计。
- `/special-stats` 独立接口统计。

不要宣称两者已经统一。

- [x] **Step 3: 更新 onboarding**

删除 `backend/modules/handoverModule.js` 条目，只保留 `backend/modules/shift-handover/`。

- [x] **Step 4: 更新任务清单**

增加并勾选 Phase 4：

```markdown
## Phase 4：删除遗留 handoverModule

- [x] 提取金额计算。
- [x] 提取日期和班次规则。
- [x] 迁移读取 SQL。
- [x] 迁移页面业务编排。
- [x] 迁移管理员备忘录。
- [x] 删除无调用旧流程和 handoverModule.js。
```

- [x] **Step 5: 扫描残留引用**

```bash
rg -n "handoverModule|backend/modules/handoverModule.js" \
  backend frontend e2e docs .ai \
  --glob '!docs/superpowers/plans/2026-06-12-split-handover-module.md'
```

Expected: 无结果。

- [x] **Step 6: 提交旧文件删除**

```bash
git add backend/modules/handoverModule.js \
  backend/modules/shift-handover/README.md \
  docs/ONBOARDING.md \
  .ai/tasks/refactor-shift-handover/TASKS.md
git commit -m "refactor: 删除旧交接班模块"
```

---

### Task 8: 最终验证

**Files:**
- Verify only

- [x] **Step 1: 检查 JavaScript 语法**

```bash
node -c backend/app.js
find backend/modules/shift-handover -name '*.js' -print0 \
  | xargs -0 -n1 node -c
```

Expected: 无语法错误。

- [x] **Step 2: 运行交接班聚焦测试**

```bash
npm --workspace backend run test -- \
  modules/shift-handover/__tests__/shiftHandover.validator.test.js \
  modules/shift-handover/__tests__/shiftHandover.calculator.test.js \
  modules/shift-handover/__tests__/shiftHandover.businessRules.test.js \
  modules/shift-handover/__tests__/shiftHandover.service.test.js \
  tests/integration/handover.test.js
```

Expected: 全部 PASS。

- [x] **Step 3: 运行后端全量测试**

```bash
npm --workspace backend run test
```

Expected: 全部 PASS。若出现与本次无关的既有失败，记录失败测试、错误信息和与本次 diff 的关系，不要静默跳过。

- [x] **Step 4: 检查日期和时区违规写法**

```bash
rg -n "toISOString|setHours|getUTCHours|setUTCHours|timezone\\s*=\\s*['\\\"]UTC|[+-]\\s*8\\s*\\*\\s*60" \
  backend/modules/shift-handover
```

Expected: 无结果。

- [x] **Step 5: 检查 diff 和工作区**

```bash
git diff --check
git status --short
git log --oneline -8
```

Expected:

- `git diff --check` 无输出。
- 不包含 `.codegraph/daemon.pid` 等运行时文件。
- 提交按测试、calculator、business rules、repository、service、删除旧文件的顺序排列。

---

## 明确不在本轮处理

- 不修改前端支付表格的本地即时计算；后端仍是最终金额权威。
- 不修改 API 路径、请求字段或响应字段。
- 不迁移数据库结构，不新增 migration。
- 不统一 overview 与 `/special-stats` 的开房统计口径；这需要独立业务规则确认和数据样例。
- 不顺便重构 `bill`、`review`、`orders` 等相邻模块。
- 不改变管理员备忘录当前存储在现金交接记录 `task_list` 中的兼容设计。

## 风险检查

- **最高风险：金额口径漂移。** 必须先写 calculator 单元测试，并保留“分计算、元返回”。
- **高风险：DATE 被当作 UTC。** 日期函数只能接受和返回 `YYYY-MM-DD`，禁止 `toISOString()`。
- **高风险：特殊统计数字变化。** 两套 SQL 先分别保留和命名，不能在结构迁移时合并。
- **中风险：昨日备用金默认规则变化。** 现金固定 320、微信取昨日完整交接、其他为 0 的现状必须由测试锁定。
- **中风险：删除仍被隐式使用的旧导出。** 删除前必须全仓库 `rg`，并跑全量后端测试。
- **中风险：JSONB 兼容。** `task_list` 可能是数组或字符串，读取时需兼容两种形态。
- **低风险：日志变化。** 可减少调试日志，但不要把日志清理混入本次拆分。
