import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useOrderStore } from 'src/stores/orderStore'

export function useRefundLogic(refreshAllData) {
  const $q = useQuasar()
  const orderStore = useOrderStore()

  // 状态
  const showRefundDepositDialog = ref(false)
  const refundDepositOrder = ref(null)
  const refundableMap = ref({})

  const allowedRefundStatuses = ['checked-out', 'cancelled']

  // 中文注释：订单列表筛选后端已返回 remainingDeposit，前端只做最小数值归一化。
  function getRemainingDeposit(order) {
    const direct = Number(order?.remainingDeposit)
    if (Number.isFinite(direct)) return Math.max(0, direct)

    // 兜底：兼容未升级数据结构时，使用本地快照估算。
    const deposit = Number(order?.deposit || 0)
    const refunded = Number(order?.refundedDeposit || 0)
    if (!Number.isFinite(deposit) || !Number.isFinite(refunded)) return 0
    return Math.max(0, deposit - refunded)
  }

  function isEligibleRefundOrder(order) {
    if (!order) return false
    return allowedRefundStatuses.includes(order.status)
  }

  // 中文注释：退押按钮资格以后端返回 canRefundDeposit 为准，前端不再解析账单明细。
  function computeRefundable(order) {
    try {
      if (!order) return
      const key = String(order.orderNumber)
      if (!isEligibleRefundOrder(order)) {
        refundableMap.value[key] = false
        return
      }
      const backendFlag = order?.canRefundDeposit
      if (backendFlag === true || backendFlag === false) {
        refundableMap.value[key] = backendFlag
        return
      }
      refundableMap.value[key] = getRemainingDeposit(order) > 0
    } catch (e) {
      console.warn('computeRefundable 失败，按不可退处理:', e)
      if (order?.orderNumber) refundableMap.value[String(order.orderNumber)] = false
    }
  }

  // 批量刷新所有订单的可退状态
  async function refreshRefundableStatus(orders = []) {
    const list = Array.isArray(orders) ? orders : []
    const nextMap = {}
    list.forEach((o) => {
      if (o?.orderNumber) nextMap[String(o.orderNumber)] = false
    })
    refundableMap.value = nextMap
    list
      .filter(o => isEligibleRefundOrder(o))
      .forEach((o) => computeRefundable(o))
  }

  // 同步判断 helper (用于 Template)
  function canRefundDeposit(order) {
    try {
      if (!isEligibleRefundOrder(order)) return false
      const key = String(order.orderNumber)
      const cached = refundableMap.value[key]
      if (cached !== undefined) return cached === true

      // 缓存尚未建立时兜底：优先走后端字段，避免前端做复杂计算。
      if (order?.canRefundDeposit === true || order?.canRefundDeposit === false) {
        return order.canRefundDeposit === true
      }
      return getRemainingDeposit(order) > 0
    } catch (e) {
      return false
    }
  }

  // 打开弹窗
  function openRefundDepositDialog(order) {
    if (!canRefundDeposit(order)) {
      $q.notify({ type: 'negative', message: '该订单不满足退押金条件', position: 'top' })
      return
    }
    refundDepositOrder.value = order
    showRefundDepositDialog.value = true
  }

  // 提交退押
  async function handleRefundDeposit(refundData) {
    try {
      const refund = await orderStore.refundDeposit(refundData)
      if (!refund) throw new Error('退押金失败')

      showRefundDepositDialog.value = false

      // 刷新数据
      await refreshAllData() // 调用外部传入的刷新函数

      // 重新计算该订单状态（基于最新后端字段）。
      const order = await orderStore.getOrderByNumber(refundData.order_id)
      if (order) computeRefundable(order)

      // 交互反馈：退押金成功后提示（用于用户确认与 E2E 断言）
      $q.notify({ type: 'positive', message: '退押金成功', position: 'top' })

    } catch (error) {
      console.error('退押金处理失败:', error)
      $q.notify({ type: 'negative', message: '退押金处理失败: ' + (error.message || '未知错误'), position: 'top' })
    }
  }

  return {
    showRefundDepositDialog,
    refundDepositOrder,
    refundableMap,
    canRefundDeposit,
    openRefundDepositDialog,
    handleRefundDeposit,
    refreshRefundableStatus
  }
}
