// src/pages/OrderManagement/composables/useRefundDepositLogic.js
import { ref, computed, watch, reactive } from 'vue'
import { orderApi } from 'src/api'
import { useUserStore } from 'src/stores/userStore'
import { useViewStore } from 'src/stores/viewStore'

export function useRefundDepositLogic(props) {
  const userStore = useUserStore()
  const viewStore = useViewStore()

  // --- 状态 ---
  const loading = ref(false)
  const remoteDepositInfo = ref(null) // API 获取的最新状态

  const refundForm = reactive({
    amount: 0,
    method: '',
    deductAmount: 0,
    notes: '',
    operator: ''
  })

  // --- 核心计算属性 ---

  // 1. 计算可退押金金额 (优先使用 API 返回的 remaining，否则使用 props 计算)
  const availableRefundAmount = computed(() => {
    if (remoteDepositInfo.value) {
      return Math.max(0, remoteDepositInfo.value.remaining)
    }
    if (!props.order) return 0
    const originalDeposit = props.order.deposit || 0
    const refundedDeposit = props.order.refundedDeposit || 0
    return Math.max(0, originalDeposit - refundedDeposit)
  })

  // 2. 实际退款金额 (申请金额 - 扣除项)
  const actualRefundAmount = computed(() => {
    const amount = refundForm.amount || 0
    const deduct = refundForm.deductAmount || 0
    return Math.max(0, amount - deduct)
  })

  // 3. 预估剩余押金 (用于 UI 提示)
  const remainingDepositAfter = computed(() => {
    const baseDeposit = remoteDepositInfo.value ? remoteDepositInfo.value.deposit : (props.order?.deposit || 0)
    const refunded = remoteDepositInfo.value ? remoteDepositInfo.value.refunded : (props.order?.refundedDeposit || 0)

    // 逻辑：总押金 - 已退 - 本次实际要退的
    // 注意：这里是否减去 deductAmount 取决于业务定义。通常 "退押金金额" 是指从押金池里划走的钱。
    // 如果 deductAmount 是"扣款"，意味着这部分钱不退给客户，但也不再是押金了（变成了收入）。
    // 所以押金池减少的量应该是 refundForm.amount。
    return Math.max(0, baseDeposit - refunded - (refundForm.amount || 0))
  })

  // 4. 表单验证
  const isFormValid = computed(() => {
    return (
      refundForm.amount > 0 &&
      !!refundForm.method &&
      !!refundForm.operator &&
      refundForm.amount <= availableRefundAmount.value &&
      refundForm.deductAmount >= 0 &&
      refundForm.deductAmount < refundForm.amount
    )
  })

  // --- 辅助显示 ---
  // 时间轴显示的格式化也可以放在这里，或者保持在组件
  const formatRefundTitle = (r) => `退款 ¥${r.actualRefundAmount || r.refundAmount || 0}`

  const formatRefundSubtitle = (r) => {
    const t = r.refundTime ? new Date(r.refundTime).toLocaleString() : ''
    const m = viewStore.getPaymentMethodName(r.method || '')
    const op = r.operator || ''
    return `${t} · ${m}${op ? (' · ' + op) : ''}`
  }

  // --- 动作 ---

  // 初始化表单
  async function initForm() {
    if (!props.order) return

    loading.value = true
    remoteDepositInfo.value = null

    // 1. 尝试获取最新数据
    try {
      const id = props.order.orderNumber || props.order.order_id
      const res = await orderApi.getDepositInfo(id)
      if (res?.data) remoteDepositInfo.value = res.data
    } catch (e) {
      console.warn('获取押金状态失败(使用本地数据):', e.message)
    } finally {
      loading.value = false
    }

    // 2. 重置表单值
    refundForm.amount = availableRefundAmount.value
    refundForm.deductAmount = 0
    refundForm.notes = ''
    refundForm.operator = userStore.user?.username || '系统操作员'

    // 3. 智能设置退款方式：优先使用订单原本的支付方式
    const orderMethod = props.order.paymentMethod || props.order.payment_method || '现金'
    refundForm.method = viewStore.normalizePaymentMethodForDB(orderMethod)
  }

  // 构造提交数据
  function getSubmitData() {
    return {
      order_id: props.order.orderNumber,
      change_price: actualRefundAmount.value, // 注意：传给后端的通常是实际退给客户的钱
      pay_way: refundForm.method,
      notes: refundForm.notes,
      operator: refundForm.operator,
      deduct_amount: refundForm.deductAmount, // 如果后端需要记录扣款
      create_time: new Date()
    }
  }

  return {
    // State
    loading,
    refundForm,
    remoteDepositInfo,
    // Computed
    availableRefundAmount,
    actualRefundAmount,
    remainingDepositAfter,
    isFormValid,
    paymentMethodOptions: computed(() => viewStore.paymentMethodOptions),
    viewStore, // 暴露给模板使用 helper 方法
    // Actions
    initForm,
    getSubmitData,
    formatRefundTitle,
    formatRefundSubtitle
  }
}
