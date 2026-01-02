// src/pages/OrderManagement/composables/useOrderFinancials.js
import { computed, ref, watch } from 'vue'
import { orderApi } from 'src/api'

export function useOrderFinancials(currentOrderRef) {
  const depositInfo = ref({
    deposit: 0,
    refunded: 0,
    remaining: 0,
    refundRecords: [],
    totalRoomFee: 0
  })

  let inFlight = null

  async function refresh() {
    const orderId = currentOrderRef.value?.orderNumber
    if (!orderId) {
      depositInfo.value = { deposit: 0, refunded: 0, remaining: 0, refundRecords: [], totalRoomFee: 0 }
      return
    }

    if (inFlight) return inFlight
    inFlight = (async () => {
      const res = await orderApi.getDepositInfo(orderId)
      depositInfo.value = res?.data || depositInfo.value
    })()

    try {
      await inFlight
    } finally {
      inFlight = null
    }
  }

  watch(() => currentOrderRef.value, () => { refresh() }, { immediate: true })

  const depositAmount = computed(() => Number(depositInfo.value?.deposit) || 0)
  const refundRecords = computed(() => Array.isArray(depositInfo.value?.refundRecords) ? depositInfo.value.refundRecords : [])
  const refundedAmount = computed(() => Number(depositInfo.value?.refunded) || 0)
  const remainingDeposit = computed(() => Number(depositInfo.value?.remaining) || 0)
  const totalRoomFee = computed(() => Number(depositInfo.value?.totalRoomFee) || 0)

  // 7. 判断是否可退押金 (逻辑复用)
  const canRefundDeposit = computed(() => {
    const order = currentOrderRef.value
    if (!order) return false

    // 只有已退房状态才能彻底退押金 (根据业务逻辑调整)
    const allowedStatuses = ['checked-out']
    if (!allowedStatuses.includes(order.status)) return false

    // 剩余押金 > 0 且 已退金额计算无误
    // 这里简化逻辑：只要剩余押金 > 0 即可
    // 注意：这里的 remainingDeposit 是 ref，需要 .value
    return remainingDeposit.value > 0
  })

  return {
    depositAmount,
    refundRecords,
    refundedAmount,
    remainingDeposit,
    totalRoomFee,
    canRefundDeposit,
    refresh
  }
}
