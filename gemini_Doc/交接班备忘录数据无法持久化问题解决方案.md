
# 交接班备忘录数据无法持久化问题解决方案

## 1. 问题根源分析

当前端通过“保存页面”功能提交数据时，备忘录列表（`taskList`）虽然被包含在发送到后端 `/api/shift-handover/save-amounts` 接口的数据包中，但后端并未将其持久化到数据库。

根本原因在于 `shift_handover` 数据库表缺少一个用于存储备忘录结构化数据（JSON数组）的字段，导致后端在执行保存逻辑时忽略了 `taskList` 数据，从而在页面刷新后无法恢复这些内容。

## 2. 解决方案概述

为了解决此问题，我们需要采取三步走策略，打通备忘录数据从前端到数据库再回到前端的完整链路：

1.  **修改数据库**：在 `shift_handover` 表中增加一个 `JSONB` 类型的字段，专门用于存储备忘录列表。
2.  **更新后端逻辑**：修改 `saveAmountChanges` 函数，使其在保存数据时能够处理并存储 `taskList`。
3.  **调整前端逻辑**：优化前端数据加载流程，确保在页面初始化时能正确地从新字段中读取备忘录数据。

## 3. 详细实施步骤

### 第一步：修改数据库表结构

我们需要为 `shift_handover` 表添加一个名为 `task_list` 的列。

**文件**: `backend/database/postgreDB/tables/shift_handover.js`

**操作**: 修改 `createQuery` 字符串，添加 `task_list` 字段。

**修改前**:
```javascript
const createQuery = `
  CREATE TABLE IF NOT EXISTS shift_handover (
    id SERIAL PRIMARY KEY, -- 交接班ID
    type VARCHAR(20) NOT NULL DEFAULT 'hotel', -- 交接班类型
    details JSONB NOT NULL DEFAULT '[]', -- 交接班详情
    statistics JSONB NOT NULL DEFAULT '{}', -- 交接班统计信息
    remarks TEXT, -- 备注
    cashier_name VARCHAR(100) NOT NULL, -- 收银员姓名
    shift_time VARCHAR(10) NOT NULL, -- 班次时间
    shift_date DATE NOT NULL, -- 班次日期
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;
```

**修改后**:
```javascript
const createQuery = `
  CREATE TABLE IF NOT EXISTS shift_handover (
    id SERIAL PRIMARY KEY, -- 交接班ID
    type VARCHAR(20) NOT NULL DEFAULT 'hotel', -- 交接班类型
    details JSONB NOT NULL DEFAULT '[]', -- 交接班详情
    statistics JSONB NOT NULL DEFAULT '{}', -- 交接班统计信息
    remarks TEXT, -- 备注
    task_list JSONB DEFAULT '[]'::jsonb, -- 备忘录列表
    cashier_name VARCHAR(100) NOT NULL, -- 收银员姓名
    shift_time VARCHAR(10) NOT NULL, -- 班次时间
    shift_date DATE NOT NULL, -- 班次日期
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;
```

**注意**: 修改后，您可能需要运行数据库迁移脚本或手动更新现有数据库表结构以应用此变更。

### 第二步：更新后端保存逻辑

现在数据库有了接收备忘录的字段，我们需要更新后端的保存函数来使用它。

**文件**: `backend/modules/shiftHandoverModule.js` (此文件未提供，但以下是修改逻辑的伪代码)

**操作**: 找到 `saveAmountChanges` 函数，在数据库 `INSERT` 或 `UPDATE` 操作中，将 `taskList` 数据存入 `task_list` 字段。

```javascript
// 在 shiftHandoverModule.js 中的 saveAmountChanges 函数

async function saveAmountChanges(amountData) {
  const { 
    date, 
    paymentData, 
    specialStats, 
    notes, 
    taskList, // 从 amountData 中解构出 taskList
    cashierName 
  } = amountData;

  // ... 其他验证逻辑 ...

  const query = `
    INSERT INTO shift_handover (shift_date, details, statistics, remarks, task_list, cashier_name, shift_time) 
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (shift_date) 
    DO UPDATE SET
      details = EXCLUDED.details,
      statistics = EXCLUDED.statistics,
      remarks = EXCLUDED.remarks,
      task_list = EXCLUDED.task_list, // <-- 确保在更新时也包含 task_list
      cashier_name = EXCLUDED.cashier_name,
      updated_at = CURRENT_TIMESTAMP;
  `;

  // 将 taskList 转换为 JSON 字符串进行存储
  const taskListJSON = JSON.stringify(taskList || []);

  const values = [
    date,
    JSON.stringify(paymentData || {}),
    JSON.stringify(specialStats || {}),
    notes || '',
    taskListJSON, // <-- 将 taskList 传入查询
    cashierName || '',
    new Date().toTimeString().slice(0, 5)
  ];

  // 执行数据库查询
  const result = await db.query(query, values);
  return result.rows[0];
}
```

### 第三步：调整前端加载逻辑

最后，我们需要确保前端在刷新时能正确加载并显示备忘录。

**文件**: `src/pages/ShiftHandover.vue`

**问题**: 当前 `loadRemarksIntoMemo` 函数从 `/api/shift-handover/remarks` 获取数据，这个接口只返回订单备注，并非我们保存的交接班备忘录。

**解决方案**: 我们应该利用 `getCurrentHandoverData` (对应路由 `/current-handover`) 一次性获取指定日期的完整交接班记录，它现在应该包含了我们存入的 `task_list`。

**操作**: 修改 `ShiftHandover.vue` 中的数据加载部分。

```vue
// src/pages/ShiftHandover.vue

// ...

// 刷新所有数据的统一入口函数
async function refreshAllData() {
  try {
    loadingShow({ message: '加载数据中...' });

    // 1. 获取当天的完整交接班记录
    const handoverRes = await shiftHandoverApi.getCurrentHandover(selectedDate.value);
    const handoverData = handoverRes.data; // 假设API返回的数据在 .data 中

    // 2. 填充备忘录
    if (handoverData && handoverData.task_list) {
      taskList.value = handoverData.task_list;
    } else {
      // 如果当天没有记录，则从订单备注加载作为备用方案
      await loadRemarksIntoMemo(); 
    }

    // 3. 填充其他数据 (支付信息、统计等)
    // ...可以从 handoverData 中直接填充，或者保持现有逻辑
    if (handoverData && handoverData.details) {
        paymentData.value = handoverData.details;
    }
    // ...

    // 确保合计正确计算
    calculateTotals();

    // 加载特殊统计
    await loadSpecialStats();

    // 先根据选中日期汇总交接表数据到 store
    await shiftHandoverStore.insertDataToShiftTable(selectedDate.value);

    // 加载交接表数据
    await loadShiftTableData();

  } catch (error) {
    console.error('刷新数据失败:', error);
    // ...
  } finally {
    loadingHide();
  }
}

// onMounted 中调用 refreshAllData 即可
onMounted(async () => {
  await refreshAllData();
});

// 注意：需要确保你的 API 封装中 (src/api/index.js) 有一个 getCurrentHandover 方法
// 它会调用 GET /api/shift-handover/current-handover?date=YYYY-MM-DD

```

## 4. 总结

通过以上三步，我们为备忘录数据建立了一个可靠的存储和读取路径。现在，当用户添加备忘录并点击“保存页面”时，数据会被正确地存入数据库的 `task_list` 字段。当用户刷新页面或重新选择日期时，前端会获取完整的交接班记录，并从中恢复备忘录内容，从而解决了数据丢失的问题。

