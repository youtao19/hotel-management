import { ref } from 'vue'
import { useQuasar } from 'quasar'
import Decimal from 'decimal.js'
import { useBillStore } from 'src/stores/billStore'
import { useOrderStore } from 'src/stores/orderStore'

export function useRefundLogic(refreshAllData) {
  const $q = useQuasar()
  const billStore = useBillStore()
  const orderStore = useOrderStore()

  // 状态
  const showRefundDepositDialog = ref(false)
  const refundDepositOrder = ref(null)
  const refundableMap = ref({})

  const allowedRefundStatuses = ['checked-out']

  const toDecimal = (val) => {
    try { return new Decimal(val || 0) } catch (e) { return new Decimal(0) }
  }

  // 核心计算：判断订单是否可退押
  async function computeRefundable(order) {
    try {
      if (!order) return
      const key = String(order.orderNumber)
      const deposit = toDecimal(order.deposit)

      // 基础校验：非退房状态或无押金，直接不可退
      if (!allowedRefundStatuses.includes(order.status) || deposit.lte(0)) {
        refundableMap.value[key] = false
        return
      }

      // 获取账单计算已退金额
      const bills = await billStore.getBillsByOrderId(key)

      let refundedFromBills = new Decimal(0)
      ;(bills || []).forEach(b => {
        if (b?.change_type === '退押') {
          const cp = toDecimal(b?.change_price)
          if (cp.isNegative()) refundedFromBills = refundedFromBills.plus(cp.abs())
        }
      })

      const legacyRefund = (bills || []).reduce((sum, b) => {
        const rd = toDecimal(b?.refund_deposit)
        if (rd.isNegative()) return sum.plus(rd.abs())
        return sum
      }, new Decimal(0))

      const refundedDeposit = toDecimal(order.refundedDeposit || 0)
      const totalRefunded = Decimal.max(refundedFromBills.plus(legacyRefund), refundedDeposit)

      // 剩余押金 > 0 才显示按钮
      refundableMap.value[key] = deposit.minus(totalRefunded).greaterThan(0)
    } catch (e) {
      console.warn('computeRefundable 失败，按不可退处理:', e)
      if (order?.orderNumber) refundableMap.value[String(order.orderNumber)] = false
    }
  }

  // 批量刷新所有订单的可退状态
  async function refreshRefundableStatus(orders = []) {
    const list = Array.isArray(orders) ? orders : []
    const tasks = list
      .filter(o => allowedRefundStatuses.includes(o.status) && toDecimal(o.deposit).gt(0))
      .map(o => computeRefundable(o))
    if (tasks.length) await Promise.allSettled(tasks)
  }

  // 同步判断 helper (用于 Template)
  function canRefundDeposit(order) {
    try {
      if (!order) return false
      const key = String(order.orderNumber)
      const cached = refundableMap.value[key]
      if (cached === undefined) return false
      return cached === true
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
      await billStore.fetchAllBills()

      // 重新计算该订单状态
      const order = await orderStore.getOrderByNumber(refundData.order_id)
      if (order) await computeRefundable(order)

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
