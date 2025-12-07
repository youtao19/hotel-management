// src/pages/OrderManagement/composables/useExtendStayLogic.js
import { ref, computed, watch } from 'vue'
import { date } from 'quasar'

export function useExtendStayLogic(currentOrderRef) {
  // --- 表单状态 ---
  const extendDays = ref(1)
  const additionalAmount = ref(0)
  const paymentMethod = ref('wechat') // 默认支付方式
  const remarks = ref('')

  // --- 计算属性 ---

  // 1. 计算新的离店日期
  const newCheckOutDate = computed(() => {
    const currentCheckout = currentOrderRef.value?.checkOutDate
    if (!currentCheckout || !extendDays.value) return ''

    const newDate = date.addToDate(new Date(currentCheckout), { days: extendDays.value })
    return date.formatDate(newDate, 'YYYY-MM-DD')
  })

  // 2. 简单的表单验证
  const isValid = computed(() => {
    return extendDays.value > 0 && additionalAmount.value >= 0
  })

  // --- 方法 ---

  // 重置表单 (通常在打开对话框时调用)
  function resetForm() {
    extendDays.value = 1
    additionalAmount.value = 0
    paymentMethod.value = 'wechat'
    remarks.value = ''
  }

  // 监听订单变化，初始化默认值 (可选)
  watch(currentOrderRef, (newOrder) => {
    if (newOrder) {
        // 如果需要，可以在这里根据房间单价预估 additionalAmount
        // 例如: additionalAmount.value = newOrder.roomPrice * 1
    }
  })

  return {
    // State
    extendDays,
    additionalAmount,
    paymentMethod,
    remarks,
    // Computed
    newCheckOutDate,
    isValid,
    // Methods
    resetForm
  }
}
