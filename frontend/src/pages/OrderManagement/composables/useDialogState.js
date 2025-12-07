// src/pages/OrderManagement/composables/useDialogState.js
import { reactive, toRefs } from 'vue'

export function useDialogState() {
  // 集中定义所有弹窗的开关状态
  const dialogs = reactive({
    details: false,        // 订单详情
    changeOrder: false,    // 修改订单
    earlyCheckout: false,  // 提前退房
    checkInConfirm: false, // 入住确认
    // 注意：ExtendStay, RefundDeposit, ChangeRoom 目前由各自的 hook 管理
    // 如果需要完全统一，可以在这里扩展，但为了兼容现有 hook，先管理主页面散落的状态
  })

  // 辅助函数：打开指定弹窗
  function openDialog(name) {
    if (Object.prototype.hasOwnProperty.call(dialogs, name)) {
      dialogs[name] = true
    }
  }

  // 辅助函数：关闭指定弹窗
  function closeDialog(name) {
    if (Object.prototype.hasOwnProperty.call(dialogs, name)) {
      dialogs[name] = false
    }
  }

  // 关闭所有 (可用于页面卸载或重置)
  function closeAll() {
    Object.keys(dialogs).forEach(key => dialogs[key] = false)
  }

  return {
    dialogs, // 作为一个响应式对象导出，方便在模板中通过 dialogs.details 访问
    ...toRefs(dialogs), // 同时导出单独的 ref，方便解构使用 (如 const { details } = ...)
    openDialog,
    closeDialog,
    closeAll
  }
}
