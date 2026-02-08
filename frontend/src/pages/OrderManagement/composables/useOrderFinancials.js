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

    // 与后端规则保持一致：已退房/已取消均可退押
    const allowedStatuses = ['checked-out', 'cancelled']
    if (!allowedStatuses.includes(order.status)) return false

    // 优先使用后端实时余额；接口未返回时，回退到订单快照，避免按钮误隐藏
    const orderId = String(order.orderNumber || '')
    const remoteOrderId = String(depositInfo.value?.orderId || '')
    if (orderId && remoteOrderId && orderId === remoteOrderId) {
      return remainingDeposit.value > 0
    }

    const localDeposit = Number(order.deposit) || 0
    const localRefunded = Number(order.refundedDeposit) || 0
    return localDeposit - localRefunded > 0
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
