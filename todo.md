1.后端有一个保存数据的借口，参数是{date:选中的日期，data:要插入的数据}
2.前端再选中日期后，获取选中日期的昨日的交接款，将这个数据作为当前选中日期的备用金，并且调用后端接口，将日期和数据一起传到后端保存起来。
3.前端在将后端数据插入到页面是，需要将选中日期的备用金也插入到页面
4.后端只需要执行插入数据到数据库的操作，数据的解析在前端完成。
5.当前已经完成了保存备用金的后端接口，你需要完成前端的调用与数据解析

---
## 备用金（reserveCash）功能实现分析（待确认后再执行）

### 一、当前状态与发现（表结构已更新）
1. 当前实际表结构文件 `backend/database/postgreDB/tables/shift_handover.js` 显示：`reserve_cash jsonb` 字段已存在（类型为 JSONB，而不是 numeric）。
2. 这意味着可以在同一列里灵活存：
	- 方案 SIMPLE：仅存一个数字：`reserve_cash = 320`（不推荐，因为列是 jsonb，应保持结构一致）。
	- 方案 STRUCT：存对象：`{"cash":320}` 或 `{"reserveCash":320, "updatedBy":"系统"}`（推荐，便于后续扩展多支付方式或历史）。
	- 方案 RICH：存结构 `{ value:320, currency:'CNY', source:'previous-day', at:'2025-09-07T08:00:00+08:00' }`（可扩展，但当前需求可能过度）。
3. 表必填字段：`cashier_name`, `shift_time`, `shift_date`, `type`；若当日只想保存备用金又没有其它数据，需要提供默认值：`cashier_name='系统'`, `shift_time='早班'`, `type='hotel'`，避免插入失败。
4. 后端 `/save-reserve` 原约定 body: `{ date, data }`，其中 `data` 将从前端传入解析后的“备用金数值或对象”。我们需规范：`data = { reserveCash: number }`；后端存入 `reserve_cash` 列时转换为 JSON：`{ reserveCash: <number> }`。
5. `/previous-handover` 接口可用于获取“上一日”记录，提取其 `reserve_cash.reserveCash` 作为今日初始值；若接口实际行为与命名不一致（当前代码似乎先查当天），可能需要自建 `GET /handover?date=` + 前端自行减一天。
6. 前端 `ShiftHandoverPaymentTable.vue` 中备用金列尚未渲染具体输入/显示；实现后需将 `paymentData.cash.reserveCash` 显示并允许（可选）编辑。
7. Store 初始值 320 是硬编码；需要在刷新或日期切换后用后端真实值覆盖。
8. UPSERT 必要性：如果同一 `(shift_date, shift_time)` 可能多次写入，需要“更新而非重复插入”。当前没有唯一约束——可：
	- 添加唯一索引 `(shift_date, shift_time)`，再使用 `ON CONFLICT (shift_date, shift_time) DO UPDATE SET reserve_cash = EXCLUDED.reserve_cash, updated_at = NOW()`。
	- 或保持无唯一索引，用 CTE：`UPDATE ... RETURNING` + `INSERT ... WHERE NOT EXISTS`（较前一个稍繁琐）。
9. JSONB 更新策略：如果以后还会向同一行写其它字段（如 `statistics`），UPSET 时需避免覆盖它们；本次仅更新 `reserve_cash`、`updated_at`，不动其他列。
10. 当前代码实际实现（cmp 差异）：
		- `saveReserve(date, reserveCash)` 位于 `shiftHandoverModule.js` 约 1170+ 行，SQL：
			```sql
			INSERT INTO shift_handover (shift_date, reserve_cash, updated_at)
			VALUES ($1, $2, CURRENT_TIMESTAMP)
			ON CONFLICT (shift_date)
			DO UPDATE SET reserve_cash = EXCLUDED.reserve_cash, updated_at = CURRENT_TIMESTAMP
			RETURNING *;
			```
		- 问题 A：表 `shift_handover` 目前无 `UNIQUE(shift_date)` 也无 `PRIMARY KEY (shift_date)`，因此 `ON CONFLICT (shift_date)` 实际在 PostgreSQL 中会抛错（没有匹配的唯一或排他约束）。
		- 问题 B：`reserve_cash` 列类型是 jsonb，但当前第二个参数 `$2` 很可能直接传入数字（`reserveCash`），导致保存的是一个 *裸 JSON 数字*（例如 `123`），而不是对象 `{ "reserveCash":123 }`，与我们规划的结构不一致，后续扩展困难。
		- 问题 C：插入列未包含必填列 `cashier_name`, `shift_time`, `type`；若数据库未设置默认值或 NOT NULL 约束会导致插入失败（目前这些列 NOT NULL，SQL 实际将失败）。说明现有 `saveReserve` 分支代码尚未在真实环境中完成或调用。
		- 结论：现实现不可用，需要重写。

11. 修复建议（cmp 结果后的改进）：
		- 先添加唯一索引：`CREATE UNIQUE INDEX IF NOT EXISTS uniq_shift_date_time ON shift_handover(shift_date, shift_time);`
		- 调整 UPSERT 目标列为 `(shift_date, shift_time)`。
		- 保存完整必填列并构造 jsonb：`reserve_cash = jsonb_build_object('reserveCash', $3)`。
		- 保留之前存在的 `reserve_cash` 若用户只想局部更改其它字段时不被覆盖（如果以后扩展，需做 merge： `reserve_cash = COALESCE(shift_handover.reserve_cash,'{}'::jsonb) || jsonb_build_object('reserveCash',$3)`）。
		- 当前阶段简化：直接覆盖值即可。

### 二、需求要点（结合原 TODO 逐条细化）
| 原需求 | 细化/补充 |
| ------ | --------- |
| 1. 后端接口 `{ date, data }` | 标准化：`data = { reserveCash: number }`；允许兼容 `data.reserve_cash`。 |
| 2. 选中日期后取“昨日交接款”做今日备用金并立即保存 | 流程：监听日期变化 → 调用 `/previous-handover` 获取对象 → 解析其 `reserve_cash`（若无则 0）→ 赋值到本地 `paymentData.cash.reserveCash` → 调用 `/save-reserve`。 |
| 3. 插入到页面 | 需要在 `ShiftHandoverPaymentTable.vue` 的“现金”行第二列显示（只读或可编辑，待确认）。 |
| 4. 后端只做插入 | 后端不参与业务拆解，只接收数值并存表。 |
| 5. 补完前端调用与解析 | 实现 API 封装 + 页面生命周期与 watch 逻辑。 |

### 三、待确认的未明确点
1. 是否需要允许用户手动修改当日备用金（如果需要，则在表格中提供可编辑输入，并再次调用保存接口）。
2. 是否一个日期只维护一条备用金（与班次无关），还是区分班次？目前表有 `shift_time` 字段——若只存一次，可固定为 `'早班'`。否则需要前端传入班次。建议：先简化为单条（固定早班）。
3. 如果当日已有交接班完整记录（含其它字段），保存备用金应为更新而不是新建——因此推荐使用 UPSERT 方案。
4. 若 `/previous-handover` 已包含当前日数据优先逻辑，需要确认其真正语义（代码里似乎先查当天再 fallback），否则可能取错。可增加专用接口或在前端自行用 `selectedDate - 1 天` 调用 `/current-handover`。

### 四、数据结构建议
前端发送：
```js
POST /save-reserve
{
	date: 'YYYY-MM-DD',
	data: { reserveCash: 320 }
}
```
后端持久化：
```
reserve_cash jsonb = { "reserveCash": 320 }
```
后端返回（建议统一）：
```json
{
	"success": true,
	"date": "2025-09-07",
	"reserveCash": 320,
	"raw": { "reserveCash": 320 }
}
```
便于前端直接取 `reserveCash`，同时保留原 JSON 以备扩展。

### 五、后端改动计划（更新后）
1. （可选）添加唯一约束：`CREATE UNIQUE INDEX IF NOT EXISTS uniq_shift_date_time ON shift_handover(shift_date, shift_time);`
2. 模块函数 `saveReserve(date, data)`：
	- 参数：`date: string`, `data: { reserveCash: number }`。
	- 校验：日期格式 / 数值非负 / 数值是有限数。
	- 设定默认：`cashier_name='系统'`, `shift_time='早班'`, `type='hotel'`（若该行不存在）。
	- SQL (如加唯一索引)：
	  ```sql
	  INSERT INTO shift_handover (shift_date, shift_time, cashier_name, type, reserve_cash)
	  VALUES ($1,'早班','系统','hotel', $2::jsonb)
	  ON CONFLICT (shift_date, shift_time)
	  DO UPDATE SET reserve_cash = EXCLUDED.reserve_cash, updated_at = NOW()
	  RETURNING id, shift_date, shift_time, reserve_cash;
	  ```
	- 若不加索引：采用 CTE 更新 + 插入。
3. 路由 `/save-reserve`：
	- 解析 `req.body.date` 与 `req.body.data.reserveCash`。
	- 调用模块函数，返回规范 JSON。
4. （可选）新增 `GET /reserve?date=`：
	- 查询最新一条该日期记录（按 `updated_at DESC LIMIT 1`）。
	- 仅返回 `{ date, reserveCash }`。

### 六、前端改动计划（更新后）
1. API 层新增：`shiftHandoverApi.saveReserve({ date, data })`。
2. 在 `ShiftHandover.vue` 中：
	- 新增函数 `loadPreviousReserve()`：根据 `selectedDate` 计算 `prevDate`（`date.subtract` 1 天），请求 `/previous-handover?date=selectedDate`（或直接用 `prevDate` + `/current-handover`，待确认），解析 `reserve_cash`。
	- 设置 `paymentData.cash.reserveCash = 前一天值`（缺省 0）。
	- 立即调用 `/save-reserve` 进行持久化。
3. 组件展示：
	- 在 `ShiftHandoverPaymentTable.vue` 现金行“备用金”格子内加入 `<q-input v-model.number="paymentData.cash.reserveCash" dense type="number" :readonly="readOnly" />`。
	- 若允许手动改：`watch(paymentData.cash.reserveCash)` + 防抖 500ms → 调用 `saveReserve`。
4. Store：增加一个 `saveReserve` 方法（可直接调用 API，或由页面直接调用）。
5. 错误处理：保存失败时提示并回滚本地值（可保留旧值）。

### 七、边界与异常场景
| 场景 | 处理方案 |
| ---- | -------- |
| 前一天没有记录 | 默认 0，仍然保存当前日 0（便于后续更新）。 |
| 当天多次快速切换日期 | 引入 `abort controller` 或以最后一次日期为准；保存操作串行。 |
| 保存失败（网络/数据库） | Toast 提示 + 保留本地修改状态，提供“重试”按钮。 |
| 后端已有记录无唯一索引导致重复 | 建议添加唯一索引并使用 UPSERT。 |
| 用户修改成非数字 | 前端限制为数字输入；后端再做校验。 |

### 八、实施步骤（更新后）
1. (后端 可选) 添加唯一索引（若选择 UPSERT via ON CONFLICT）。
2. (后端) 实现 / 修正 `saveReserve` 函数与路由（仅处理 JSONB）。
3. (前端) 新增 `shiftHandoverApi.saveReserve`。
4. (前端) 日期 watch：加载昨日备用金 → 写入本地 → 立即调用保存确保行存在。
5. (前端) 表格中显示备用金；若允许编辑，加防抖自动保存。
6. (前端) 新增错误提示 & 重试逻辑。
7. (测试) 后端接口：
	- 插入新日期
	- 再次保存同日期（应更新，不新增行）
8. (测试) 前端：切换日期、编辑数值、刷新恢复。

### 九、需要你确认的点（请回复序号 + 你的选择）
1. 是否创建唯一索引 `(shift_date, shift_time)` 并采用 ON CONFLICT？(是/否)
2. 班次是否固定写死为 '早班' 保存？(是/否，如果否，请说明获取来源)
3. 备用金是否允许页面手动编辑并自动保存？(是/否)
4. “昨日备用金”获取方式：使用 `/previous-handover` 还是直接 `prevDate = selectedDate - 1` 后调 `/current-handover`？(previous / compute)
5. 返回 JSON 结构是否采用 `{ success, date, reserveCash, raw }`？是
6. `reserve_cash` JSON 里是否仅存 `{ reserveCash }` 还是需要附加 meta（如更新时间 / 来源）？simple
7. 初次未找到昨日记录时是否仍然写入 0 并保存当前行？是

确认后将按步骤执行实现。

确认后我再按上述步骤实施代码修改。

---

### 十、获取昨日交接款作为今日备用金的具体实现方案（新增）

目标：当用户选择日期 `D`（即“今日”）时，自动获取 `D-1`（昨日）的交接班记录中的交接款，作为今日初始 `reserveCash`，并立即写入今日记录。

#### 1. 接口选择策略
| 方案 | 描述 | 优点 | 风险/缺点 | 结论 |
|------|------|------|-----------|------|
| A: 使用 `/previous-handover?date=D` | 后端内部处理“前一天”逻辑 | 前端简单 | 当前实现里可能先查当天再降级，语义不纯 | 不推荐（需改后端方可纯粹） |
| B: 前端自行计算 prevDate，然后 `/current-handover?date=prevDate` | 明确、可控 | 不依赖后端内部隐式逻辑 | 需要一次日期计算 | 推荐 |

采用方案 B：前端自行计算 `prevDate = dayjs(D).subtract(1,'day')`（或使用 Quasar `date.subtractFromDate`）。

#### 2. 数据提取规则
从昨日记录对象中读取字段：
1. `reserve_cash` 若为：
	 - 数字：直接作为金额。
	 - JSON 对象：优先取 `reserve_cash.reserveCash`、否则尝试 `reserve_cash.value`、都没有则回退 0。
2. 没有记录 → 使用默认 0。

#### 3. 写入今日逻辑
1. 将值赋给本地：`paymentData.cash.reserveCash = extractedValue`。
2. 立即调用 `/save-reserve`：
```json
POST /api/shift/save-reserve
{ "date": D, "data": { "reserveCash": <value> } }
```
3. 保存成功后：
	 - 更新本地 store（保持单一来源）。
	 - 标记页面 “已初始化今日备用金”。

#### 4. 前端伪代码（组合流程）
```js
async function initReserveCashFor(dateStr) {
	const prevDate = dayjs(dateStr).subtract(1, 'day').format('YYYY-MM-DD')
	let previous = null
	try {
		previous = await shiftHandoverApi.getCurrentHandover(prevDate) // GET /current-handover?date=prevDate
	} catch (_) {}

	let reserve = 0
	if (previous) {
		const raw = previous.reserve_cash
		if (typeof raw === 'number') reserve = raw
		else if (raw && typeof raw === 'object') {
			reserve = Number(raw.reserveCash ?? raw.value ?? 0) || 0
		}
	}

	paymentData.value.cash.reserveCash = reserve

	try {
		await shiftHandoverApi.saveReserve({
			date: dateStr,
			data: { reserveCash: reserve }
		})
	} catch (e) {
		$q.notify({ type: 'negative', message: '保存今日备用金失败: ' + e.message })
	}
}

watch(selectedDate, (d) => {
	if (d) initReserveCashFor(d)
})
```

#### 5. 错误与防抖
| 情况 | 处理 |
|------|------|
| 用户快速切换日期 | 使用一个递增 token / abort flag，只保留最后一次 `initReserveCashFor` 结果 |
| 保存失败 | 不回滚本地显示，但标记一个 `reserveCashDirty=true` 以便后续手动重试 |
| 昨日无记录 | 使用 0 并仍然创建今日行，便于后续其它数据写入 |

#### 6. 与其它保存的交互
`save-reserve` 仅负责 `reserve_cash`；其它金额行或统计保存仍走已有保存/导入接口，不互相覆盖。若未来需要一次性保存可考虑合并请求。

#### 7. 后续扩展（占位）
| 方向 | 说明 |
|------|------|
| 历史来源标记 | 在 JSON 中加入 `{ reserveCash:320, source:'previous-day', from:'2025-09-06' }` |
| 多班次备用金 | JSON 结构扩展为 `{ shifts: { 早班:320, 晚班:150 } }` |
| 变更追踪 | 新增 `reserve_cash_log` 表或在 JSON 中维护 `history` 数组 |

---