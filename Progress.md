# 任务：按 `AGENTS.md` 增加收入统计测试

## 修改流程（待确认）

1. **需求对齐（已完成）**
   - 确认测试口径：以 `orders.stay_date` 为单日口径，排除 `status='cancelled'`，对 `total_price` 求和，与 `GET /api/revenue/quick-stats` 的 `data.today.total_revenue` 对齐。

2. **导入 orders.csv（已完成）**
   - 在后端集成测试里读取并导入 `sql/orders.csv`（同时导入必要的 `sql/room_types.sql` / `sql/rooms.sql` 以满足外键）。

3. **编写测试样例（已完成）**
   - 新增用例断言（按 `AGENTS.md`）：  
     `2025-11-02` → `3115.14`  
     `2025-11-03` → `3233.97`  
     `2025-11-04` → `3462.66`  
     `2025-11-05` → `3675.12`  
     `2025-11-06` → `2891.76`  
     `2025-11-07` → `4845.85`

4. **补充前端默认行为（已完成）**
   - 使「详细收入数据」表：默认展示全部账单数据，同时筛选栏日期默认展示“今日”（不强制按今日过滤，除非点击查询）。

5. **执行测试（已完成）**
   - 已执行：`npm --workspace backend run test -- --runInBand --testPathPattern tests/integration/revenue_statistics.test.js`（通过）

6. **提交代码（已完成）**
   - 已执行：`git add .`
   - 已执行：`git commit -m "增加收入统计测试：导入orders.csv并校验单日收入"`
