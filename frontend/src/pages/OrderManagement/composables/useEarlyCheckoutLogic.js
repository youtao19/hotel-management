// 提前退房逻辑封装
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useOrderStore } from 'src/stores/orderStore'
import { useUserStore } from 'src/stores/userStore'
import { useViewStore } from 'src/stores/viewStore'
import { orderApi } from 'src/api'

/**
 * 提前退房业务逻辑 Hook
 * @param {Object} props - 组件 props，需包含 order (当前订单对象) 和 modelValue (弹窗显示状态)
 * @param {Function} emit - 组件 emit 方法，用于触发事件
 */
export function useEarlyCheckoutLogic(props, emit) {
  const $q = useQuasar()
  const orderStore = useOrderStore()
  const userStore = useUserStore()
  const viewStore = useViewStore()

  // --- 状态定义 ---
  const actualCheckoutTime = ref('') // 实际退房时间 (YYYY-MM-DDTHH:mm)
  const refundAmount = ref(0) // 实际退款金额
  const refundMethod = ref('') // 退款方式
  const remarks = ref('') // 备注
  const manualAmountTouched = ref(false) // 用户是否手动修改过退款金额
  const submitting = ref(false) // 提交中状态
  const loadingOrderDetails = ref(false) // 加载推荐数据中状态（保持变量名不改动，避免影响模板）
  const recommendation = ref(null) // 后端推荐退款信息
  const hasStayed = ref(true) // 是否已入住 (true: 已入住, false: 未入住直接退房)

  const paymentMethodOptions = viewStore.paymentMethodOptions


  const refundableNights = computed(() => recommendation.value?.refundableNights || [])

  // 计算建议退款总金额（由后端统一计算）
  const recommendedRefund = computed(() => Number(recommendation.value?.recommendedRefund || 0))

  // 建议退款的安全数值（保留两位小数，NaN/负值时兜底为0）
  const recommendedRefundRounded = computed(() => {
    const val = Number(recommendedRefund.value)
    if (!Number.isFinite(val) || val < 0) return 0
    return Number(val.toFixed(2))
  })

  // 退款金额校验规则
  const refundAmountRules = [
    val => val !== null && val !== undefined && val >= 0 || '退款金额必须大于或等于0',
    val => val <= recommendedRefundRounded.value + 0.01 || `退款金额不能超过¥${recommendedRefundRounded.value.toFixed(2)}`
  ]

  // 显示实际退款与建议金额的差额提示
  const refundDiffText = computed(() => {
    const diff = Number(refundAmount.value || 0) - recommendedRefundRounded.value
    if (Math.abs(diff) < 0.01) return '与建议金额一致'
    return diff > 0
      ? `多退 ¥${diff.toFixed(2)}`
      : `少退 ¥${Math.abs(diff).toFixed(2)}`
  })

  // 警告：实际退房时间晚于原计划退房时间 (此时不应属于提前退房)
  const showNotEarlyWarning = computed(() => {
    if (!hasStayed.value) return false
    // 中文注释：提前退房可行性由后端 recommendation.validation 决定，前端不再自行比较日期。
    const canEarlyCheckout = recommendation.value?.validation?.canEarlyCheckout
    if (canEarlyCheckout === undefined) return false
    return !canEarlyCheckout
  })

  // 后端返回的不可提前退房原因（用于提示文案）
  const notEarlyWarningText = computed(() => recommendation.value?.validation?.message || '实际退房时间需要早于原退房时间，当前选择可能无法触发提前退房。')

  // 表单提交按钮是否可用
  const canSubmit = computed(() => {
    if (!props.order) return false
    // 必须有退房时间且不能晚于原计划
    if (!actualCheckoutTime.value || showNotEarlyWarning.value) return false
    if (hasStayed.value && !recommendation.value) return false
    // 退款金额校验
    if (refundAmount.value === null || refundAmount.value === undefined) return false
    if (refundAmount.value < 0) return false
    if (refundAmount.value - recommendedRefundRounded.value > 0.01) return false
    // 必须选择退款方式
    if (!refundMethod.value) return false
    return true
  })

  /**
   * 通用日期格式化
   */
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

  /**
   * 格式化 Date 对象为 input[type="datetime-local"] 所需格式
   */
  function formatForInput(dateObj) {
    if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return ''
    const y = dateObj.getFullYear()
    const m = String(dateObj.getMonth() + 1).padStart(2, '0')
    const d = String(dateObj.getDate()).padStart(2, '0')
    const hh = String(dateObj.getHours()).padStart(2, '0')
    const mm = String(dateObj.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d}T${hh}:${mm}`
  }

  // 设置实际退房时间为当前时间
  function setActualCheckoutToNow() {
    actualCheckoutTime.value = formatForInput(new Date())
  }

  // 使用建议退款金额填充输入框
  function useRecommendedAmount() {
    refundAmount.value = recommendedRefundRounded.value
    manualAmountTouched.value = false
  }

  function closeDialog() {
    emit('update:modelValue', false)
  }

  async function loadRecommendation() {
    const oid = props.order?.orderNumber || props.order?.order_id || props.order?.orderId
    if (!oid || !actualCheckoutTime.value) {
      recommendation.value = null
      return
    }

    try {
      loadingOrderDetails.value = true
      // 使用对象参数传递，避免 GET params 不是对象导致请求失败
      const resp = await orderApi.earlyCheckoutRecommendation(oid, { actualCheckoutTime: actualCheckoutTime.value, hasStayed: hasStayed.value }) // 统一使用对象传参
      recommendation.value = resp.data
    } catch (error) {
      recommendation.value = null
      console.warn('加载提前退房推荐失败:', error?.message || error)
    } finally {
      loadingOrderDetails.value = false
    }
  }

  // 初始化表单数据
  function initializeForm() {
    if (!props.order) return
    hasStayed.value = true
    actualCheckoutTime.value = formatForInput(new Date())
    refundMethod.value = props.order.paymentMethod
    remarks.value = ''
    manualAmountTouched.value = false
  }

  function applySuggestedAmountIfUntouched() {
    if (manualAmountTouched.value) return
    refundAmount.value = recommendedRefundRounded.value
  }

  // 提交提前退房请求
  async function handleSubmit() {
    if (!canSubmit.value || !props.order) return
    try {
      submitting.value = true
      const payload = {
        actualCheckoutTime: actualCheckoutTime.value,
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

  // --- 监听器 ---

  // 监听弹窗打开，初始化数据
  watch(
    () => props.modelValue,
    async (val) => {
      if (val) {
        initializeForm()
        await loadRecommendation()
        // 初始加载完成后，自动填入建议金额
        applySuggestedAmountIfUntouched()
      } else {
        recommendation.value = null
      }
    }
  )

  // 监听建议金额变化，如果用户未手动修改过，则自动更新退款金额
  watch(
    () => recommendedRefundRounded.value,
    () => applySuggestedAmountIfUntouched()
  )

  // 监听入住状态变化，切换时重置金额逻辑
  watch(
    () => hasStayed.value,
    (val) => {
      if (!val) {
        manualAmountTouched.value = false
        refundAmount.value = recommendedRefundRounded.value
      }
    }
  )

  // 弹窗开启且推荐加载完成后，再次同步推荐金额（防止初次加载时因异步造成0）
  watch(
    () => [props.modelValue, loadingOrderDetails.value],
    ([visible, loading]) => {
      if (!visible || loading) return
      applySuggestedAmountIfUntouched()
    }
  )

  // 监听关键字段变化，重新拉取后端推荐
  watch(
    () => [props.modelValue, actualCheckoutTime.value, hasStayed.value],
    async ([visible]) => {
      if (!visible) return
      await loadRecommendation()
      applySuggestedAmountIfUntouched()
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
    loadingOrderDetails,
    paymentMethodOptions,
    refundableNights,
    // computed helpers
    recommendedRefund,
    recommendedRefundRounded,
    refundAmountRules,
    refundDiffText,
    showNotEarlyWarning,
    notEarlyWarningText,
    canSubmit,
    // actions
    formatDate,
    setActualCheckoutToNow,
    useRecommendedAmount,
    closeDialog,
    handleSubmit
  }
}
