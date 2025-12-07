// src/pages/OrderManagement/composables/useOrderFinancials.js
import { computed } from 'vue'
import { useBillStore } from 'src/stores/billStore'
import Decimal from 'decimal.js'

export function useOrderFinancials(currentOrderRef) {
  const billStore = useBillStore()

  // --- 辅助工具 ---
  const toDecimal = (val) => {
    try { return new Decimal(val || 0) } catch { return new Decimal(0) }
  }

  const toAmountNumber = (decimalVal) => {
    return Number(decimalVal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())
  }

  // --- 核心数据计算 ---

  // 1. 获取当前订单关联的所有账单
  const billsForThisOrder = computed(() => {
    if (!currentOrderRef.value) return []
    // 确保 billStore 已经加载
    return billStore.bills.filter(b => b.order_id === currentOrderRef.value.orderNumber)
  })

  // 2. 计算押金金额 (优先从订单取，如果为0则从账单找)
  const depositAmount = computed(() => {
    const dep = toDecimal(currentOrderRef.value?.deposit)
    if (dep.gt(0)) return toAmountNumber(dep)

    const b = billsForThisOrder.value.find(x => toDecimal(x.deposit).gt(0))
    return b ? toAmountNumber(toDecimal(b.deposit)) : 0
  })

  // 3. 生成退款/退押记录列表
  const refundRecords = computed(() => {
    const recs = []
    billsForThisOrder.value.forEach(b => {
      // 情况A: change_type 为 '退押'
      if (b && b.change_type === '退押') {
        const amount = toDecimal(b.change_price).abs()
        if (amount.gt(0)) {
          recs.push({ amount: toAmountNumber(amount), method: b.pay_way, time: b.create_time })
        }
      }
      // 情况B: 兼容旧结构 (refund_deposit < 0)
      else if (b?.refund_deposit !== undefined && toDecimal(b.refund_deposit).lt(0)) {
        const amount = toDecimal(b.refund_deposit).abs()
        if (amount.gt(0)) {
          recs.push({
            amount: toAmountNumber(amount),
            method: b.pay_way,
            time: b.refund_time || b.create_time
          })
        }
      }
    })
    return recs.sort((a, c) => new Date(a.time) - new Date(c.time))
  })

  // 4. 计算已退总金额
  const refundedAmount = computed(() => {
    const sum = refundRecords.value.reduce((s, r) => s.plus(toDecimal(r.amount)), new Decimal(0))
    return toAmountNumber(sum)
  })

  // 5. 计算剩余未退押金
  const remainingDeposit = computed(() => {
    const left = toDecimal(depositAmount.value).minus(toDecimal(refundedAmount.value))
    return left.gt(0) ? toAmountNumber(left) : 0
  })

  // 6. 计算总房费 (优先查账单，无账单查订单字段)
  const totalRoomFee = computed(() => {
    const orderId = currentOrderRef.value?.orderNumber
    if (!orderId) return 0

    const relatedBills = billsForThisOrder.value

    // 如果没有关联账单，回退到订单快照数据
    if (!relatedBills.length) {
      const rp = currentOrderRef.value?.roomPrice
      if (rp && typeof rp === 'object') {
        const sum = Object.values(rp).reduce((acc, v) => acc.plus(toDecimal(v)), new Decimal(0))
        return toAmountNumber(sum)
      }
      return toAmountNumber(toDecimal(rp))
    }

    // 统计所有房费类型的账单
    const sum = relatedBills.reduce((acc, bill) => {
      const isRoomFee = bill.change_type === '房费'
      // 兼容旧字段 room_fee
      const roomFeeField = bill.room_fee
      const amount = isRoomFee
        ? toDecimal(bill.change_price)
        : toDecimal(roomFeeField)
      return acc.plus(amount)
    }, new Decimal(0))

    return toAmountNumber(sum)
  })

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
    canRefundDeposit
  }
}
