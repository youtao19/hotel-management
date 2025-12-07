// src/pages/OrderManagement/composables/useEarlyCheckoutLogic.js
import { ref, computed, watch, reactive } from 'vue'
import { date } from 'quasar'
import { useBillStore } from 'src/stores/billStore'
import Decimal from 'decimal.js'

export function useEarlyCheckoutLogic(props, emit) {
  const billStore = useBillStore()

  // --- 表单状态 ---
  const form = reactive({
    newCheckOutDate: '',
    penaltyAmount: 0,
    refundMethod: 'wechat', // 默认退款方式
    remarks: ''
  })

  // --- 辅助计算 ---
  const toDecimal = (val) => {
    try { return new Decimal(val || 0) } catch { return new Decimal(0) }
  }

  // 1. 获取当前订单的总已付金额 (房费 + 押金? 或者仅房费，视业务而定)
  // 通常提前退房主要涉及房费的结算，押金可能单独退或一起算。
  // 这里假设我们计算的是 "剩余应退房费"。
  const totalPaidRoomFee = computed(() => {
    if (!props.order) return 0
    const bills = billStore.bills.filter(b => b.order_id === props.order.orderNumber)

    // 简单的逻辑：所有“房费”类型的入账 - 出账
    // 如果没有账单，可能需要回退到 order.roomPrice (视系统逻辑而定)
    let total = new Decimal(0)
    bills.forEach(b => {
      if (b.change_type === '房费' || b.type === 'income') { // 假设 income 是收款
         total = total.plus(toDecimal(b.change_price))
      }
    })

    // 如果账单为空，且订单有价格，回退使用订单总价
    if (total.eq(0) && props.order.roomPrice) {
       return toDecimal(props.order.roomPrice)
    }
    return total
  })

  // 2. 计算实际入住天数
  const actualDays = computed(() => {
    if (!props.order || !form.newCheckOutDate) return 0
    const start = new Date(props.order.checkInDate)
    const end = new Date(form.newCheckOutDate)
    const diff = date.getDateDiff(end, start, 'days')
    return diff > 0 ? diff : 0 // 至少算0天（或者1天，视业务规则）
  })

  // 3. 计算实际应收房费 (简单按单价 * 天数估算，实际可能需要复杂计费)
  const actualRoomCost = computed(() => {
    // 尝试获取单价：总价 / 原定天数
    if (!props.order || !props.order.checkInDate || !props.order.checkOutDate) return 0

    const originalStart = new Date(props.order.checkInDate)
    const originalEnd = new Date(props.order.checkOutDate)
    const originalDays = date.getDateDiff(originalEnd, originalStart, 'days') || 1

    const unitPrice = totalPaidRoomFee.value.div(originalDays)
    return unitPrice.mul(actualDays.value)
  })

  // 4. 计算建议退款金额
  const refundAmount = computed(() => {
    // 已付 - 实际应收 - 违约金
    const refund = totalPaidRoomFee.value
      .minus(actualRoomCost.value)
      .minus(toDecimal(form.penaltyAmount))

    return refund.isNegative() ? 0 : Number(refund.toDecimalPlaces(2).toString())
  })

  // --- 初始化与重置 ---
  watch(() => props.order, (newOrder) => {
    if (newOrder) {
      // 默认新离店日期为今天 (如果今天在入住日期之后)
      const today = new Date()
      const checkIn = new Date(newOrder.checkInDate)

      if (today > checkIn) {
        form.newCheckOutDate = date.formatDate(today, 'YYYY-MM-DD')
      } else {
        form.newCheckOutDate = date.formatDate(checkIn, 'YYYY-MM-DD')
      }

      form.penaltyAmount = 0
      form.remarks = ''

      // 确保账单数据已加载
      if (billStore.bills.length === 0) {
        billStore.fetchAllBills()
      }
    }
  }, { immediate: true })

  // --- 提交 ---
  function submit() {
    const submitData = {
      orderNumber: props.order.orderNumber,
      newCheckOutDate: form.newCheckOutDate,
      penaltyAmount: Number(form.penaltyAmount),
      refundAmount: refundAmount.value,
      refundMethod: form.refundMethod,
      remarks: form.remarks
    }
    emit('success', submitData) // 父组件监听 @success 处理 API 调用
  }

  // 验证
  const isValid = computed(() => {
    return !!form.newCheckOutDate && !!form.refundMethod
  })

  return {
    form,
    refundAmount,
    actualDays,
    isValid,
    submit
  }
}
