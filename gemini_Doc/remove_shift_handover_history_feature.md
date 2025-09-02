# 移除历史记录功能需求

## 需求概述

根据用户要求，将彻底移除酒店管理系统中的交接班历史记录功能。这包括前端界面的组件、相关的API调用、后端处理逻辑以及数据库中可能存在的相关数据（如果之前未移除）。

## 详细移除范围

1.  **前端组件移除：**
    *   删除 `src/components/ShiftHandoverHistory.vue` 文件。
    *   删除 `src/components/ShiftHandoverDetail.vue` 文件。
    *   在 `src/pages/ShiftHandover.vue` 中，移除对 `ShiftHandoverHistory` 组件的引用、相关的按钮（如“历史记录”按钮）、数据（如 `historyDialogRef`）和方法（如 `openHistoryDialog`, `onHistoryDialogClose`）。

2.  **前端 API 调用移除：**
    *   在 `src/api/index.js` 中，移除所有与交接班历史记录相关的 API 调用函数，例如 `getHandoverHistory` 和 `deleteHandoverRecord`。

3.  **前端 Pinia Store 移除：**
    *   在 `src/stores/shiftHandoverStore.js` 中，移除所有与交接班历史记录相关的 actions 或 state，例如 `fetchHandoverHistory` 等。

4.  **后端路由移除：**
    *   在 `backend/routes/shiftHandoverRoute.js` 中，移除所有与交接班历史记录相关的路由，例如 `router.get('/history', ...)` 和 `router.delete('/:recordId', ...)`。

5.  **后端模块功能移除：**
    *   在 `backend/modules/shiftHandoverModule.js` 中，移除所有与交接班历史记录相关的函数，例如 `getHandoverHistory` 和 `deleteHandoverRecord`。

## 实施步骤

将按照上述范围，从前端到后端逐步进行代码的删除和清理工作，确保功能的完整移除且不影响其他模块。
