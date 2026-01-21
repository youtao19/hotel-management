# 进度跟踪（提前退房推荐 + 金额精度）

## 背景/现象
- 前端报错：`网络请求失败: target must be an object`
- 触发点：`useEarlyCheckoutLogic.js` 调用 `orderApi.earlyCheckoutRecommendation(...)` 时失败
- 需求：提前退房推荐金额计算需要使用 Decimal，避免浮点误差

---

## 修改流程（待确认）

### 1. 阅读业务说明（必须）
- 打开并阅读 `业务说明.md`
- 确认“提前退房推荐”的输入参数、退款计算口径、已入住/未入住逻辑、日期字段规则

### 2. 定位并复现问题
- 查看前端 `orderApi.earlyCheckoutRecommendation` 的定义（参数签名/序列化方式）
- 查看后端对应接口（路由/控制器/模块）期望的入参结构
- 复现 `target must be an object`，确认是“前后端入参不一致（string vs object）”还是“请求封装对 params/data 的要求”

### 3. 修复前后端接口契约不一致（最小改动）
- 统一接口入参：`{ actualCheckoutTime, hasStayed }`
- 前端尽量不做业务逻辑判断：只负责传参 + 展示
- 增加必要注释，避免后续再次传错类型

### 4. 后端金额计算改用 Decimal（推荐接口）
- 在 `getEarlyCheckoutRecommendation` 内：
  - `total_price` 的求和用 `Decimal` 累加
  - 输出给前端的 `recommendedRefund` 统一保留两位小数
- 确保不违反日期规范（不使用 `new Date(date)` / `toISOString()` 处理 DATE 字段）

### 5. 增加测试样例（让我确认后再写）
- 为后端 `getEarlyCheckoutRecommendation` 增加单测：
  - 用例：多天 `total_price` 小数相加（例如 0.1 + 0.2 + 0.3）应精确得到 0.60
  - 用例：`hasStayed=false` 时 refundableNights 计算覆盖全部天数
  - 用例：缺少 `actualCheckoutTime` 返回 400（或对应错误码）
- 测试框架按仓库现状选择（jest/mocha 等）

### 6. 提交（完成测试后执行）
- `git add -A`
- 中文 commit message
- `git commit -m "..."`

---

## 当前状态
- [x] 1. 阅读业务说明
- [x] 2. 定位并复现问题
- [x] 3. 修复接口契约
- [x] 4. Decimal 金额计算改造
- [ ] 5. 编写并确认测试样例
- [ ] 6. git add + git commit（中文信息）
