# 系统 change_type 类型分析报告

## 📊 完整类型列表

根据代码库分析，当前系统中存在以下 **6种** `change_type` 类型：

### 1. **房费** 
- **用途**：记录房间费用
- **金额特征**：正数（收入）
- **过滤规则**：按 `stay_date`（入住日期）过滤
- **使用场景**：
  - 办理入住时为每天创建房费账单
  - 按住宿天数分摊总房费
- **代码位置**：
  ```javascript
  // backend/modules/orderModule.js
  change_type: '房费'
  ```

### 2. **收押** / **押金**
- **用途**：记录收取的押金
- **金额特征**：正数（收入）
- **过滤规则**：按 `stay_date`（入住日期）过滤
- **使用场景**：
  - 办理入住时收取押金
  - 仅在首日创建一条押金账单
- **代码位置**：
  ```javascript
  // backend/modules/orderModule.js
  change_type: '收押'
  ```
- **注意**：
  - 数据库中使用 `'收押'`
  - 部分旧代码可能使用 `'押金'`（已兼容）

### 3. **退押** / **退押金**
- **用途**：记录退还的押金
- **金额特征**：负数（支出）
- **过滤规则**：按 `create_time`（创建时间）过滤
- **使用场景**：
  - 退房时退还押金
  - 取消订单时退还押金
- **代码位置**：
  ```javascript
  // backend/modules/orderModule.js
  refundData.change_type = '退押'
  refundData.change_price = -Math.abs(refundData.change_price)
  ```
- **注意**：
  - 数据库中使用 `'退押'`
  - 前端可能使用 `'退押金'`（已兼容）
  - **金额存储为负数**，显示时需取绝对值

### 4. **补收**
- **用途**：记录补收款项
- **金额特征**：正数（收入）
- **过滤规则**：按 `create_time`（创建时间）过滤
- **使用场景**：
  - 退房时补收额外费用
  - 消费追加收费
- **代码位置**：
  ```javascript
  // frontend/src/components/BillAdjustmentDialog.vue
  adjustmentTypes = ['补收', '退款']
  ```

### 5. **退款**
- **用途**：记录退款
- **金额特征**：负数（支出）
- **过滤规则**：按 `create_time`（创建时间）过滤
- **使用场景**：
  - 客户退款申请
  - 账单调整时的退款
- **代码位置**：
  ```javascript
  // frontend/src/components/BillAdjustmentDialog.vue
  adjustmentTypes = ['补收', '退款']
  ```

### 6. **订单账单**（兼容性类型）
- **用途**：旧版本的账单类型（兼容用）
- **金额特征**：正数（收入）
- **过滤规则**：按 `stay_date`（入住日期）过滤
- **使用场景**：
  - 兼容旧版数据
  - 测试代码中使用
- **代码位置**：
  ```javascript
  // backend/modules/billModule.js
  change_type IN ('房费', '收押', '订单账单')
  ```
- **注意**：新版本不再创建此类型，仅用于兼容旧数据

## 📋 类型分类

### 按金额特征分类

#### 收入类型（正数）
1. **房费** - 房间收入
2. **收押** - 押金收入
3. **补收** - 补收收入
4. **订单账单** - 旧版本账单（兼容）

#### 支出类型（负数）
1. **退押** - 退还押金
2. **退款** - 退款支出

### 按过滤规则分类

#### 按入住日期 (stay_date) 过滤
- 房费
- 收押
- 订单账单

#### 按创建时间 (create_time) 过滤
- 退押
- 退款
- 补收

## 🔍 代码中的使用示例

### 1. 查询特定类型账单
```javascript
// backend/routes/billRoute.js
WHERE (
  -- 房费、收押按入住日期过滤
  (b.stay_date::date = $1::date AND b.change_type IN ('房费', '收押', '订单账单'))
  OR
  -- 退押、退款、补收按创建日期过滤
  (DATE(b.create_time) = $1::date AND b.change_type IN ('退押', '退款', '补收'))
)
```

### 2. 创建账单
```javascript
// backend/modules/orderModule.js
// 房费账单
{
  change_type: '房费',
  change_price: 300  // 正数
}

// 收押账单
{
  change_type: '收押',
  change_price: 100  // 正数
}

// 退押账单
{
  change_type: '退押',
  change_price: -100  // 负数
}
```

### 3. 前端统计逻辑
```javascript
// frontend/src/components/handover/CheckData.vue
if (changeType === '房费') {
  summaryDataObject.value.hotelIncome[normalizedPayWay] += amount
} else if (changeType === '收押' || changeType === '押金') {
  summaryDataObject.value.hotelDeposit[normalizedPayWay] += amount
} else if (changeType === '退押' || changeType === '退押金') {
  summaryDataObject.value.hotelRefundDeposit[normalizedPayWay] += Math.abs(amount)
}
```

## ⚠️ 重要注意事项

### 1. 类型名称一致性
- **数据库标准**：`'房费'`, `'收押'`, `'退押'`, `'补收'`, `'退款'`, `'订单账单'`
- **前端兼容**：需同时支持 `'押金'` → `'收押'`，`'退押金'` → `'退押'`

### 2. 金额符号规则
- **收入（正数）**：房费、收押、补收、订单账单
- **支出（负数）**：退押、退款
- **显示规则**：退押和退款在表格中显示绝对值

### 3. 过滤规则差异
- **按入住日期**：房费、收押、订单账单
- **按创建时间**：退押、退款、补收
- **原因**：收入按住宿日期归属，支出按实际发生时间归属

### 4. 交接班统计
在交接班表格中的对应关系：
- **客房收入1 / 休息房收入2** = 房费 + 收押
- **客房退押 / 休息退押** = 退押（取绝对值）
- **补收** 和 **退款** 目前未在交接表中单独展示

## 📝 建议

1. **统一类型名称**：建议在代码中统一使用数据库标准名称
2. **文档化**：在表结构注释中明确说明所有类型
3. **枚举定义**：建议创建枚举常量避免硬编码字符串
4. **类型验证**：在插入账单前验证 change_type 的合法性

## 📅 分析日期

2025-10-08






