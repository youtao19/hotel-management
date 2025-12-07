// 提前退房逻辑封装
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useOrderStore } from 'src/stores/orderStore'
import { useBillStore } from 'src/stores/billStore'
import { useUserStore } from 'src/stores/userStore'
import { useViewStore } from 'src/stores/viewStore'

export function useEarlyCheckoutLogic(props, emit) {
  const $q = useQuasar()
  const orderStore = useOrderStore()
  const billStore = useBillStore()
  const userStore = useUserStore()
  const viewStore = useViewStore()

  const actualCheckoutTime = ref('')
  const refundAmount = ref(0)
  const refundMethod = ref('')
  const remarks = ref('')
  const manualAmountTouched = ref(false)
  const submitting = ref(false)
  const loadingBills = ref(false)
  const orderBills = ref([])
  const hasStayed = ref(true)

  const paymentMethodOptions = viewStore.paymentMethodOptions

  const actualCheckoutDateYMD = computed(() => {
    if (!actualCheckoutTime.value) return null
    return actualCheckoutTime.value.slice(0, 10)
  })

  const recommendedBills = computed(() => {
    if (!hasStayed.value) return []
    if (!props.order || !actualCheckoutDateYMD.value) return []
    const cutoff = actualCheckoutDateYMD.value
    const grouped = new Map()
    ;(orderBills.value || []).forEach(b => {
      if (!b || b.change_type !== '房费') return
      const stayDate = formatDateOnly(b.stay_date || b.stayDate)
      if (!stayDate || stayDate < cutoff) return
      const amount = Number(b.change_price || b.room_fee || 0)
      const prev = grouped.get(stayDate) || 0
      grouped.set(stayDate, Number((prev + amount).toFixed(2)))
    })
    return Array.from(grouped.entries())
      .map(([stayDate, amount]) => ({ stayDate, amount }))
      .sort((a, b) => a.stayDate.localeCompare(b.stayDate))
  })

  const totalPaid = computed(() => {
    const bills = orderBills.value || []
    const orderDepositRaw = Number(props.order?.deposit)
    const orderDeposit = Number.isFinite(orderDepositRaw) && orderDepositRaw > 0 ? orderDepositRaw : 0
    const orderTotalRaw = Number(props.order?.roomPrice ?? props.order?.total_price)
    const orderTotal = Number.isFinite(orderTotalRaw) && orderTotalRaw > 0 ? orderTotalRaw : 0
    if (!bills.length) {
      return Math.max(0, orderDeposit, orderTotal)
    }
    const net = bills.reduce((sum, b) => sum + Number(b?.change_price || 0), 0)
    const normalizedNet = Math.max(0, Number(net.toFixed(2)))
    if (normalizedNet === 0) {
      return Math.max(0, orderDeposit, orderTotal)
    }
    return normalizedNet
  })

  const recommendedRefund = computed(() => {
    if (!hasStayed.value) {
      return totalPaid.value
    }
    return recommendedBills.value.reduce((sum, item) => sum + Number(item.amount), 0)
  })

  const refundableNights = computed(() => recommendedBills.value)

  const refundAmountRules = [
    val => val !== null && val !== undefined && val >= 0 || '退款金额必须大于或等于0',
    val => val <= recommendedRefund.value + 0.01 || `退款金额不能超过¥${recommendedRefund.value.toFixed(2)}`
  ]

  const refundDiffText = computed(() => {
    const diff = Number(refundAmount.value || 0) - recommendedRefund.value
    if (Math.abs(diff) < 0.01) return '与建议金额一致'
    return diff > 0
      ? `多退 ¥${diff.toFixed(2)}`
      : `少退 ¥${Math.abs(diff).toFixed(2)}`
  })

  const showNotEarlyWarning = computed(() => {
    if (!hasStayed.value) return false
    if (!props.order?.checkOutDate || !actualCheckoutTime.value) return false
    return new Date(actualCheckoutTime.value) >= new Date(props.order.checkOutDate)
  })

  const canSubmit = computed(() => {
    if (!props.order) return false
    if (!actualCheckoutTime.value || showNotEarlyWarning.value) return false
    if (refundAmount.value === null || refundAmount.value === undefined) return false
    if (refundAmount.value < 0) return false
    if (refundAmount.value - recommendedRefund.value > 0.01) return false
    if (!refundMethod.value) return false
    return true
  })

  function formatDateOnly(input) {
    if (!input) return null
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input
    const date = new Date(input)
    if (Number.isNaN(date.getTime())) return null
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function formatDate(dateInput, includeTime = false) {
    if (!dateInput) return '--'
    const date = new Date(dateInput)
    if (Number.isNaN(date.getTime())) return dateInput
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    let formatted = `${y}-${m}-${d}`
    if (includeTime) {
      const hh = String(date.getHours()).padStart(2, '0')
      const mm = String(date.getMinutes()).padStart(2, '0')
      formatted += ` ${hh}:${mm}`
    }
    return formatted
  }

  function formatForInput(dateObj) {
    if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return ''
    const y = dateObj.getFullYear()
    const m = String(dateObj.getMonth() + 1).padStart(2, '0')
    const d = String(dateObj.getDate()).padStart(2, '0')
    const hh = String(dateObj.getHours()).padStart(2, '0')
    const mm = String(dateObj.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d}T${hh}:${mm}`
  }

  function setActualCheckoutToNow() {
    actualCheckoutTime.value = formatForInput(new Date())
  }

  function useRecommendedAmount() {
    refundAmount.value = Number(recommendedRefund.value.toFixed(2))
    manualAmountTouched.value = false
  }

  function closeDialog() {
    emit('update:modelValue', false)
  }

  async function loadBills() {
    if (!props.order?.orderNumber) {
      orderBills.value = []
      return
    }
    try {
      loadingBills.value = true
      const bills = await billStore.getBillsByOrderId(props.order.orderNumber)
      orderBills.value = bills || []
    } catch (error) {
      orderBills.value = []
      console.warn('加载订单账单失败:', error.message || error)
    } finally {
      loadingBills.value = false
    }
  }

  function initializeForm() {
    if (!props.order) return
    hasStayed.value = true
    const now = new Date()
    const planned = props.order.checkOutDate ? new Date(props.order.checkOutDate) : null
    let base = now
    if (planned && now >= planned) {
      base = new Date(planned.getTime() - 60 * 60 * 1000)
    }
    actualCheckoutTime.value = formatForInput(base)
    refundMethod.value = props.order.paymentMethod || viewStore.paymentMethodOptions?.[0]?.value || '现金'
    remarks.value = ''
    manualAmountTouched.value = false
  }

  async function handleSubmit() {
    if (!canSubmit.value || !props.order) return
    try {
      submitting.value = true
      const isoTime = new Date(actualCheckoutTime.value)
      if (Number.isNaN(isoTime.getTime())) {
        $q.notify({ type: 'negative', message: '请选择有效的退房时间' })
        return
      }

      const payload = {
        actualCheckoutTime: isoTime.toISOString(),
        refundAmount: Number(refundAmount.value || 0),
        refundMethod: refundMethod.value,
        operator: userStore.user?.username || 'system',
        remarks: remarks.value,
        hasStayed: hasStayed.value
      }

      const result = await orderStore.earlyCheckout(props.order.orderNumber, payload)
      $q.notify({ type: 'positive', message: '提前退房已完成' })
      emit('success', result)
      closeDialog()
    } catch (error) {
      const message = error.response?.data?.message || error.message || '提前退房失败'
      $q.notify({ type: 'negative', message, multiLine: true })
    } finally {
      submitting.value = false
    }
  }

  watch(
    () => props.modelValue,
    async (val) => {
      if (val) {
        initializeForm()
        await loadBills()
        refundAmount.value = Number(recommendedRefund.value.toFixed(2))
      } else {
        orderBills.value = []
      }
    }
  )

  watch(
    () => recommendedRefund.value,
    (val) => {
      if (!manualAmountTouched.value) {
        refundAmount.value = Number(val.toFixed(2))
      }
    }
  )

  watch(
    () => hasStayed.value,
    (val) => {
      if (!val) {
        manualAmountTouched.value = false
        refundAmount.value = Number(recommendedRefund.value.toFixed(2))
      }
    }
  )

  return {
    // state
    actualCheckoutTime,
    refundAmount,
    refundMethod,
    remarks,
    hasStayed,
    manualAmountTouched,
    submitting,
    loadingBills,
    paymentMethodOptions,
    refundableNights,
    // computed helpers
    recommendedRefund,
    refundAmountRules,
    refundDiffText,
    showNotEarlyWarning,
    canSubmit,
    // actions
    formatDate,
    setActualCheckoutToNow,
    useRecommendedAmount,
    closeDialog,
    handleSubmit
  }
}
