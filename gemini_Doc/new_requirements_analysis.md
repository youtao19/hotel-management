# 新需求分析文档 (更新)

#### 1. 文档目的

本文档旨在详细分析用户提出的所有新需求，明确其对前端、后端和数据库数据流的影响，并作为后续实现方案的理解基础。

#### 2. 新需求列表

1.  **表格中的数据只采用订单数据导入。**
2.  **备忘录的显示规则改为：从订单中获取，加上管理员增加到数据库中的数据。**
3.  **将保存页面按钮的功能改为将管理员增加的备忘录数据单独存放到数据表中，而来自订单中的备注不保存。**
4.  **在特殊统计表中，大美卡和收银员来源于数据库，其余数据都是根据订单自动导入。这两个数据在前端是可以修改的。保存页面按钮也需要保存这两个数据到后端数据库。**

#### 3. 需求逐条分析与理解

##### 需求一：表格中的数据只采用订单数据导入。

*   **理解**：
    *   这里的“表格中的数据”特指 `ShiftHandoverPaymentTable` 中展示的支付数据 (`paymentData`)。
    *   这意味着 `paymentData` 将**不再**作为 `shift_handover` 记录的一部分进行保存（无论是草稿还是最终提交）。
    *   `paymentData` 始终是**实时计算**并从最新的订单和退款数据中导入的。用户在前端对 `paymentData` 的任何手动修改都将是临时的，页面刷新后会丢失，因为它们不会被持久化。
*   **影响**：
    *   **数据库 (`shift_handover` 表)**：`details` 字段（目前用于存储 `paymentData`）将不再存储支付数据。它可能变得冗余，或者需要重新定义其用途。
    *   **后端 (`shiftHandoverModule.js`)**：
        *   `saveAmountChanges` 函数（对应“保存页面”）将**不再**接收或保存 `paymentData` 到 `details` 字段。
        *   `saveHandover` 函数（对应“保存交接表”）也将**不再**接收或保存 `paymentData` 到 `details` 字段。
    *   **前端 (`ShiftHandover.vue`)**：
        *   `savePageData` 和 `saveHandover` 函数在构建 `payload` 时，将**不再包含 `paymentData`**。
        *   `refreshAllData` 函数在加载数据时，`paymentData` 将**始终**通过调用 `shiftHandoverStore.insertDataToShiftTable` 来填充，而**不再**尝试从 `handoverRecord.details` 中获取。

##### 需求二：备忘录的显示规则改为：从订单中获取，加上管理员增加到数据库中的数据。

*   **理解**：
    *   前端 `ShiftHandoverMemoList` 中展示的备忘录列表 (`taskList`) 将是一个**组合列表**。
    *   **来源一**：来自订单的备注。这些备注存储在 `orders` 表中，并通过 `loadRemarksIntoMemo` 函数获取。
    *   **来源二**：管理员通过交接班页面手动添加的备忘录。这些备忘录将存储在 `shift_handover` 表的 `task_list` 字段中。
    *   前端需要将这两个来源的数据合并，并按时间或其他逻辑进行排序展示。
*   **影响**：
    *   **数据库 (`shift_handover` 表)**：`task_list` 字段将专门用于存储管理员手动添加的备忘录。
    *   **后端 (`shiftHandoverModule.js`)**：
        *   `saveAmountChanges` 和 `saveHandover` 函数在处理 `taskList` 时，将只保存**管理员手动添加的部分**到 `shift_handover.task_list`。
        *   `getRemarks` 函数（或类似函数）将继续用于从 `orders` 表中获取订单备注。
    *   **前端 (`ShiftHandover.vue`)**：
        *   `refreshAllData` 函数需要同时调用获取订单备注的逻辑（`loadRemarksIntoMemo`）和获取 `shift_handover.task_list` 的逻辑。
        *   `taskList` `ref` 将需要合并这两个来源的数据。
        *   管理员添加新备忘录时，需要确保其数据结构与从订单获取的备注兼容，以便合并显示。

##### 需求三：将保存页面按钮的功能改为将管理员增加的备忘录数据单独存放到数据表中，而来自订单中的备注不保存。

*   **理解**：
    *   这明确了“保存页面”按钮 (`savePageData`) 的**单一职责**。
    *   它将**只负责**将用户在前端界面上**手动添加**的备忘录项（即非来自订单的备忘录）保存到 `shift_handover` 表的 `task_list` 字段中。
    *   来自订单的备注（`orders.remarks`）**永远不会**通过“保存页面”按钮保存到 `shift_handover` 表中。
*   **影响**：
    *   **后端 (`shiftHandoverModule.js`)**：
        *   `saveAmountChanges` 函数将变得非常精简。它将**只接收和保存 `taskList`**（特指管理员添加的部分）到 `shift_handover.task_list` 字段。
        *   `saveAmountChanges` 将**不再**保存 `paymentData`、`notes`、`specialStats` 等数据（与需求四冲突，将在需求四中修正）。
    *   **前端 (`ShiftHandover.vue`)**：
        *   `savePageData` 函数在构建 `payload` 时，将**只包含 `taskList`**（且只包含管理员手动添加的部分）。
        *   `savePageData` 的成功提示信息也应反映其新功能（例如：“备忘录草稿已保存”）。
    *   **`saveHandover` (对应“保存交接表”)**：
        *   `saveHandover` 仍然是最终提交所有交接班数据的按钮。它将保存 `handoverPerson`, `receivePerson`, `cashierName`, `notes`, `specialStats`。
        *   关于 `taskList`，`saveHandover` 应该保存**管理员添加的备忘录**到 `shift_handover.task_list`。订单备注部分不应被保存到 `shift_handover`。

##### 需求四：在特殊统计表中，大美卡和收银员来源于数据库，其余数据都是根据订单自动导入。这两个数据在前端是可以修改的。保存页面按钮也需要保存这两个数据到后端数据库。

*   **理解**：
    *   **特殊统计数据来源**：
        *   `vipCards` (大美卡) 和 `cashierName` (收银员) 将从 `shift_handover` 表中加载和保存。
        *   `totalRooms` (开房数), `restRooms` (休息房数), `goodReview` (好评) 将继续根据订单数据自动导入（通过 `loadSpecialStats` 获取）。
    *   **可修改性**：`vipCards` 和 `cashierName` 在前端是可编辑的。
    *   **保存页面按钮功能扩展**：`savePageData` 函数（“保存页面”按钮）除了保存管理员添加的备忘录外，现在还需要保存 `vipCards` 和 `cashierName` 到后端数据库。
*   **影响**：
    *   **数据库 (`shift_handover` 表)**：
        *   `cashier_name` 字段已存在。
        *   `vipCards` 将作为 `statistics` JSONB 字段的一个属性进行存储。
    *   **后端 (`shiftHandoverModule.js`)**：
        *   **`saveAmountChanges` (对应“保存页面”)**：
            *   现在需要接收 `taskList` (管理员添加部分), `vipCards`, `cashierName`。
            *   将 `taskList` 保存到 `shift_handover.task_list`。
            *   将 `cashierName` 保存到 `shift_handover.cashier_name`。
            *   将 `vipCards` 保存到 `shift_handover.statistics` JSONB 字段中。
            *   `saveAmountChanges` 将**不再**保存 `paymentData` 和 `notes`。
        *   **`saveHandover` (对应“保存交接表”)**：
            *   其保存逻辑需要与 `saveAmountChanges` 保持一致，确保 `cashierName` 和 `vipCards` 也能被最终保存。
    *   **前端 (`ShiftHandover.vue`)**：
        *   **`savePageData` 函数**：
            *   构建 `payload` 时，将包含 `taskList` (管理员添加部分), `vipCards`, `cashierName`。
            *   `pageData` 将**不再包含 `paymentData` 和 `notes`**。
        *   **`refreshAllData` 函数**：
            *   加载 `handoverRecord` 后，`cashierName.value` 应从 `handoverRecord.cashier_name` 填充。
            *   `vipCards` 应从 `handoverRecord.statistics.vipCards` 填充。
            *   `loadSpecialStats()` 仍然需要调用，其结果只用于填充 `totalRooms`, `restRooms`, `goodReview`。

#### 4. 整体数据流与挑战

这些新需求将导致 `shift_handover` 表中 `details` 字段的用途发生变化（不再存储 `paymentData`），并且 `saveAmountChanges` 函数的功能被大幅度缩小，但同时又增加了对 `vipCards` 和 `cashierName` 的保存。

**主要挑战**：

*   **`paymentData` 的处理**：确保 `details` 字段不再被 `paymentData` 占用，并调整所有相关保存和加载逻辑。
*   **`taskList` 的合并与分离**：前端需要清晰地管理来自订单的备注和管理员添加的备忘录，并在保存时只提交管理员添加的部分。
*   **`saveAmountChanges` 的精简与扩展**：确保它只处理管理员添加的备忘录、`vipCards` 和 `cashierName`，并且不影响其他字段。
*   **`saveHandover` 的调整**：确保它在最终保存时，能够正确处理所有字段，包括管理员添加的备忘录、`vipCards` 和 `cashierName`，并且不尝试保存订单备注。
*   **`specialStats` 的复合加载**：前端 `specialStats` 的数据来源将变得复杂，一部分来自 `shift_handover` 记录，一部分来自订单计算。