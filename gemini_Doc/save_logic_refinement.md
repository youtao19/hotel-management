
# 交接班页面保存逻辑细化建议

根据用户对“保存页面数据”和“保存交接表”功能的明确定义：

*   **“保存页面数据”**：是临时的，只保存可修改的内容（草稿）。
*   **“保存交接表”**：是永久的，是最终的提交。

这要求我们对前端、后端和数据库进行更精细的划分和调整，以实现清晰的功能职责和数据流。

## 1. 数据库层面调整 (`backend/database/postgreDB/tables/shift_handover.js`)

为了区分临时保存和永久保存的记录，我们需要在 `shift_handover` 表中增加一个 `status` 字段，并为交班人/接班人添加独立字段。

*   **新增字段**: `status VARCHAR(20) NOT NULL DEFAULT 'draft'`
    *   `'draft'`：表示临时保存的草稿数据。
    *   `'finalized'`：表示最终提交的交接班记录。
*   **新增字段**: `handover_person VARCHAR(100)` 和 `receive_person VARCHAR(100)`，用于存储交班人/接班人信息，这些信息通常在最终提交时才确定。

**修改 `shift_handover.js` 中的 `createQuery`**:

```javascript
// backend/database/postgreDB/tables/shift_handover.js

const createQuery = `
  CREATE TABLE IF NOT EXISTS shift_handover (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL DEFAULT 'hotel',
    details JSONB NOT NULL DEFAULT '[]',
    statistics JSONB NOT NULL DEFAULT '{}',
    remarks TEXT,
    task_list JSONB DEFAULT '[]'::jsonb,
    cashier_name VARCHAR(100) NOT NULL,
    shift_time VARCHAR(10) NOT NULL,
    shift_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 新增状态字段
    handover_person VARCHAR(100), -- 交班人
    receive_person VARCHAR(100), -- 接班人
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (shift_date, status) -- 确保同一日期下，draft 和 finalized 状态的记录是唯一的
  );
`;
```

**注意**: 修改数据库表结构后，您需要运行相应的数据库迁移或手动更新现有数据库以应用此变更。

## 2. 后端逻辑调整 (`backend/modules/shiftHandoverModule.js`)

需要修改 `saveAmountChanges` 和 `saveHandover` 这两个函数，使其职责明确，并处理 `status` 字段。

### 2.1. `saveAmountChanges` (对应“保存页面数据” - 临时保存)

*   **目的**：只保存用户在页面上直接修改的、作为草稿的数据。
*   **保存内容**：`paymentData` (details), `taskList`, `cashierName`, `notes`, `specialStats` (statistics)。
*   **状态**：始终设置为 `'draft'`。
*   **交班人/接班人**：**不更新**这两个字段，或者将其设置为 `NULL`。

**伪代码示例 (`shiftHandoverModule.js`)**:

```javascript
// backend/modules/shiftHandoverModule.js

async function saveAmountChanges(amountData) {
  const {
    date,
    paymentData,
    specialStats,
    notes,
    taskList,
    cashierName
  } = amountData;

  // 尝试查找现有记录，优先查找 finalized，其次 draft
  let existingRecord = await db.query(
    `SELECT * FROM shift_handover WHERE shift_date = $1 AND status = 'finalized'`,
    [date]
  );

  if (existingRecord.rows.length === 0) {
    existingRecord = await db.query(
      `SELECT * FROM shift_handover WHERE shift_date = $1 AND status = 'draft'`,
      [date]
    );
  }

  if (existingRecord.rows.length > 0) {
    // 更新现有草稿或在 finalized 记录上更新可修改部分
    const query = `
      UPDATE shift_handover
      SET
        details = $1,
        statistics = $2,
        remarks = $3,
        task_list = $4,
        cashier_name = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE shift_date = $6 AND status = 'draft' -- 确保只更新草稿
      RETURNING *;
    `;
    const values = [
      JSON.stringify(paymentData || {}),
      JSON.stringify(specialStats || {}),
      notes || '',
      JSON.stringify(taskList || []),
      cashierName || '',
      date
    ];
    const result = await db.query(query, values);
    if (result.rows.length === 0) {
        // 如果没有更新到草稿，可能是因为只有 finalized 记录，此时需要插入新的 draft
        // 或者更合理的做法是，如果存在 finalized，则不允许再保存 draft
        // 这里简化处理，如果没更新到 draft，就尝试插入新的 draft
        const insertQuery = `
            INSERT INTO shift_handover (shift_date, details, statistics, remarks, task_list, cashier_name, status, shift_time)
            VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
            ON CONFLICT (shift_date, status) DO UPDATE SET
                details = EXCLUDED.details,
                statistics = EXCLUDED.statistics,
                remarks = EXCLUDED.remarks,
                task_list = EXCLUDED.task_list,
                cashier_name = EXCLUDED.cashier_name,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const insertValues = [
            date,
            JSON.stringify(paymentData || {}),
            JSON.stringify(specialStats || {}),
            notes || '',
            JSON.stringify(taskList || []),
            cashierName || '',
            new Date().toTimeString().slice(0, 5)
        ];
        return (await db.query(insertQuery, insertValues)).rows[0];
    }
    return result.rows[0];
  } else {
    // 插入新的草稿记录
    const query = `
      INSERT INTO shift_handover (shift_date, details, statistics, remarks, task_list, cashier_name, status, shift_time)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
      RETURNING *;
    `;
    const values = [
      date,
      JSON.stringify(paymentData || {}),
      JSON.stringify(specialStats || {}),
      notes || '',
      JSON.stringify(taskList || []),
      cashierName || '',
      new Date().toTimeString().slice(0, 5)
    ];
    return (await db.query(query, values)).rows[0];
  }
}
```

### 2.2. `saveHandover` (对应“保存交接表” - 永久保存)

*   **目的**：保存完整的、最终的交接班记录。
*   **保存内容**：所有字段，包括 `handoverPerson`, `receivePerson`, `paymentData`, `taskList`, `cashierName`, `notes`, `specialStats`。
*   **状态**：设置为 `'finalized'`。
*   **逻辑**：
    *   如果已存在该日期的 `finalized` 记录，则更新它。
    *   如果只存在 `draft` 记录，则将其 `status` 更新为 `finalized`，并更新所有字段。
    *   如果不存在任何记录，则插入一条新的 `finalized` 记录。

**伪代码示例 (`shiftHandoverModule.js`)**:

```javascript
// backend/modules/shiftHandoverModule.js

async function saveHandover(handoverData) {
  const {
    date,
    handoverPerson,
    receivePerson,
    cashierName,
    notes,
    taskList,
    paymentData,
    specialStats
  } = handoverData;

  // 检查是否已存在 finalized 记录
  const existingFinalized = await db.query(
    `SELECT * FROM shift_handover WHERE shift_date = $1 AND status = 'finalized'`,
    [date]
  );

  if (existingFinalized.rows.length > 0) {
    // 更新现有 finalized 记录
    const query = `
      UPDATE shift_handover
      SET
        handover_person = $1,
        receive_person = $2,
        cashier_name = $3,
        remarks = $4,
        task_list = $5,
        details = $6,
        statistics = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE shift_date = $8 AND status = 'finalized'
      RETURNING *;
    `;
    const values = [
      handoverPerson || '',
      receivePerson || '',
      cashierName || '',
      notes || '',
      JSON.stringify(taskList || []),
      JSON.stringify(paymentData || {}),
      JSON.stringify(specialStats || {}),
      date
    ];
    return (await db.query(query, values)).rows[0];
  } else {
    // 检查是否存在 draft 记录
    const existingDraft = await db.query(
      `SELECT * FROM shift_handover WHERE shift_date = $1 AND status = 'draft'`,
      [date]
    );

    if (existingDraft.rows.length > 0) {
      // 将 draft 记录更新为 finalized
      const query = `
        UPDATE shift_handover
        SET
          handover_person = $1,
          receive_person = $2,
          cashier_name = $3,
          remarks = $4,
          task_list = $5,
          details = $6,
          statistics = $7,
          status = 'finalized', -- 状态更新为 finalized
          updated_at = CURRENT_TIMESTAMP
        WHERE shift_date = $8 AND status = 'draft'
        RETURNING *;
      `;
      const values = [
        handoverPerson || '',
        receivePerson || '',
        cashierName || '',
        notes || '',
        JSON.stringify(taskList || []),
        JSON.stringify(paymentData || {}),
        JSON.stringify(specialStats || {}),
        date
      ];
      return (await db.query(query, values)).rows[0];
    } else {
      // 插入新的 finalized 记录
      const query = `
        INSERT INTO shift_handover (
          shift_date, handover_person, receive_person, cashier_name, remarks,
          task_list, details, statistics, status, shift_time
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'finalized', $9)
        RETURNING *;
      `;
      const values = [
        date,
        handoverPerson || '',
        receivePerson || '',
        cashierName || '',
        notes || '',
        JSON.stringify(taskList || []),
        JSON.stringify(paymentData || {}),
        JSON.stringify(specialStats || {}),
        new Date().toTimeString().slice(0, 5)
      ];
      return (await db.query(query, values)).rows[0];
    }
  }
}
```

### 2.3. `getCurrentHandoverData` (数据加载)

*   **目的**：根据日期加载交接班记录，优先加载 `finalized` 状态的记录，如果不存在则加载 `draft` 状态的记录。

**伪代码示例 (`shiftHandoverModule.js`)**:

```javascript
// backend/modules/shiftHandoverModule.js

async function getCurrentHandoverData(date, status = null) {
  let query = `SELECT * FROM shift_handover WHERE shift_date = $1`;
  const values = [date];

  if (status) {
    query += ` AND status = $2`;
    values.push(status);
  } else {
    // 如果没有指定状态，优先返回 finalized，否则返回 draft
    query += ` ORDER BY CASE WHEN status = 'finalized' THEN 1 ELSE 2 END LIMIT 1`;
  }

  const result = await db.query(query, values);
  return result.rows[0] || null;
}
```

## 3. 前端逻辑调整 (`src/pages/ShiftHandover.vue`)

### 3.1. `savePageData` 函数

*   **调整 `pageData` 的内容**：只包含“可修改”的部分，即 `paymentData`, `taskList`, `cashierName`, `notes`, `specialStats`。**移除 `handoverPerson` 和 `receivePerson`**，因为它们属于最终提交的内容。

```vue
// src/pages/ShiftHandover.vue

async function savePageData() {
  try {
    // ... 数据验证 ...

    savingAmounts.value = true;
    loadingShow({ message: '保存数据中...' });

    const pageData = {
      date: selectedDate.value,
      // handoverPerson: handoverPerson.value, // 移除
      // receivePerson: receivePerson.value, // 移除
      cashierName: cashierName.value,
      notes: notes.value,
      taskList: JSON.parse(JSON.stringify(taskList.value)),
      paymentData: JSON.parse(JSON.stringify(paymentData.value)),
      specialStats: {
        totalRooms: totalRooms.value,
        restRooms: restRooms.value,
        vipCards: vipCards.value,
        goodReview: goodReview.value,
        totalIncome: totalIncome.value,
        totalDeposit: totalDeposit.value
      }
    };

    // 调用保存API端点
    await shiftHandoverApi.saveAmountChanges(pageData);

    hasChanges.value = false;
    $q.notify({
      type: 'positive',
      message: '页面数据保存成功',
      caption: '草稿已保存',
      position: 'top',
      timeout: 3000
    });

  } catch (error) {
    console.error('保存页面数据失败:', error);
    $q.notify({
      type: 'negative',
      message: '保存页面数据失败',
      caption: error.message || '请检查数据并重试',
      position: 'top',
      timeout: 5000
    });
  } finally {
    savingAmounts.value = false;
    loadingHide();
  }
}
```

### 3.2. `saveHandover` 函数

*   保持原样，它应该包含所有最终提交的数据，包括 `handoverPerson` 和 `receivePerson`。

### 3.3. 数据加载 (`refreshAllData` 函数)

*   在加载数据时，需要优先尝试加载 `finalized` 状态的记录。如果不存在 `finalized` 记录，再加载 `draft` 状态的记录。这需要后端 `getCurrentHandoverData` 接口支持按状态查询。

```vue
// src/pages/ShiftHandover.vue

async function refreshAllData() {
  try {
    loadingShow({ message: '加载数据中...' });

    let handoverRecord = null;

    // 1. 尝试获取 finalized 状态的记录
    try {
      // 假设 shiftHandoverApi.getCurrentHandover 支持 status 参数
      const finalizedRes = await shiftHandoverApi.getCurrentHandover(selectedDate.value, 'finalized');
      if (finalizedRes.data) {
        handoverRecord = finalizedRes.data;
      }
    } catch (e) {
      console.warn('未找到 finalized 记录或获取失败:', e);
    }

    // 2. 如果没有 finalized 记录，尝试获取 draft 状态的记录
    if (!handoverRecord) {
      try {
        const draftRes = await shiftHandoverApi.getCurrentHandover(selectedDate.value, 'draft');
        if (draftRes.data) {
          handoverRecord = draftRes.data;
        }
      } catch (e) {
        console.warn('未找到 draft 记录或获取失败:', e);
      }
    }

    // 3. 根据获取到的记录填充页面数据
    if (handoverRecord) {
      handoverPerson.value = handoverRecord.handover_person || '';
      receivePerson.value = handoverRecord.receive_person || '';
      cashierName.value = handoverRecord.cashier_name || '';
      notes.value = handoverRecord.remarks || '';
      taskList.value = handoverRecord.task_list || [];
      paymentData.value = handoverRecord.details || {};
      // specialStats 需要单独处理，因为前端和后端结构可能不完全一致
      // totalRooms.value = handoverRecord.statistics?.totalRooms || 0;
      // restRooms.value = handoverRecord.statistics?.restRooms || 0;
      // vipCards.value = handoverRecord.statistics?.vipCards || 0;
      // goodReview.value = handoverRecord.statistics?.goodReview || '邀1得1';
    } else {
      // 如果当天没有记录，清空页面数据或加载默认值
      handoverPerson.value = '';
      receivePerson.value = '';
      cashierName.value = '张'; // 默认值
      notes.value = '';
      taskList.value = [];
      // 重置 paymentData 为初始结构
      paymentData.value = {
        cash: { reserveCash: 320, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 320 },
        wechat: { reserveCash: 0, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 0 },
        digital: { reserveCash: 0, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 0 },
        other: { reserveCash: 0, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 0 }
      };
    }

    // 确保合计正确计算
    calculateTotals();

    // 加载特殊统计 (确保 specialStats 总是最新的)
    await loadSpecialStats();

    // 先根据选中日期汇总交接表数据到 store
    await shiftHandoverStore.insertDataToShiftTable(selectedDate.value);

    // 加载交接表数据
    await loadShiftTableData();

  } catch (error) {
    console.error('刷新数据失败:', error);
    $q.notify({
      type: 'negative',
      message: '刷新数据失败',
      caption: error.message,
      timeout: 3000
    });
  } finally {
    loadingHide();
  }
}
```

## 4. 总结

通过以上数据库结构、后端逻辑和前端加载/保存逻辑的细化调整，您将能够清晰地实现“保存页面数据”（临时草稿）和“保存交接表”（永久提交）的功能分离，并确保数据的一致性和持久化。这不仅解决了潜在的冲突问题，也使得整个交接班模块的数据管理更加健壮和易于维护。
