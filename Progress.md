# Progress

## 任务：修正 `sql/orders.csv` 中 stay_date = `2025-11-07` 的 `total_price`

### 流程
1. 检查 `sql/orders.csv`：筛选 `stay_date = 2025-11-07` 的记录，并定位房号 `105/106/107/108/110/205/211/311/312/212/402` 对应行（确认 `total_price` 字段列名/位置）。
2. 按你提供的“图片金额”为准，更新这些记录的 `total_price` 为：
   - 105 → 86.02
   - 106 → 91.51
   - 107 → 86.90
   - 108 → 130.00
   - 110 → 91.51
   - 205 → 168.00
   - 211 → 160.00
   - 311 → 169.00
   - 312 → 143.06
   - 212 → 198.04
   - 402 → 178.73
3. 写一个测试样例（脚本/用例）用于校验：在 `stay_date=2025-11-07` 下，上述房号的 `total_price` 与目标值完全一致；把用例内容发你确认。
4. 你确认后执行：`git add -A`，并用中文 commit message 提交。

### 当前状态
- [x] 1) 检查并定位需要修改的行
- [x] 2) 修改 `total_price` 并复核（补充修正：`301/302`；并同步修正 `sql/bills.csv` / `sql/bills.sql` 的 `change_price`）
- [x] 3) 编写测试样例并请求确认（`node sql/tools/test_orders_total_price_2025-11-07.mjs`；`node sql/tools/test_bills_change_price_2025-11-07.mjs`）
- [ ] 4) 通过确认后提交（git add + git commit）
