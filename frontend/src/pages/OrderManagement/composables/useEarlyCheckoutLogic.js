// 提前退房逻辑封装
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useOrderStore } from 'src/stores/orderStore'
import { useUserStore } from 'src/stores/userStore'
import { useViewStore } from 'src/stores/viewStore'

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
  const loadingOrderDetails = ref(false) // 加载订单明细中状态
  const orderDailyRows = ref([]) // 订单关联的每日行数据
  const hasStayed = ref(true) // 是否已入住 (true: 已入住, false: 未入住直接退房)

  const paymentMethodOptions = viewStore.paymentMethodOptions


  // 提取实际退房日期的 YYYY-MM-DD 部分，用于比较
  const actualCheckoutDateYMD = computed(() => {
    // 统一用 formatDate 解析，避免浏览器本地化格式(如含斜杠/逗号)导致字符串比较失真
    return formatDate(actualCheckoutTime.value)
  })

/**
 * 计算建议退款的每日价格列表 (仅针对已入住情况)
 * 逻辑：找出所有 stayDate >= 实际退房日期的订单行 total_price，按日期聚合
 */
  const recommendedBills = computed(() => {
    // 未入住则无每日退款建议
    if (!hasStayed.value) return []
    // 如果订单或实际退房日期无效，返回空
    if (!props.order || !actualCheckoutDateYMD.value) return []
    const cutoff = actualCheckoutDateYMD.value // 实际退房日期

    let billslist = [];
    console.log('订单每日行数据:', orderDailyRows.value);

    for (const orderDaily of orderDailyRows.value) {
      const stayDateYMD = formatDate(orderDaily.stayDate) // 订单的入住时间
      console.log('处理订单每日行:', stayDateYMD);
      if (!stayDateYMD || stayDateYMD < cutoff) continue
      const amount = Number(orderDaily.roomPrice);
      billslist.push({
        stayDate: stayDateYMD,
        roomPrice: amount
      });
    }
    console.log('建议退款的房晚列表:', billslist);
    return billslist;
  })

  /**
   * 计算订单已支付总额
   * 逻辑：基于订单每日明细 roomPrice + deposit
   */
  const totalPaid = computed(() => {
    const daily = orderDailyRows.value || []
    if (daily.length) {
      const dailyTotal = daily.reduce((sum, item) => sum + Number(item.roomPrice), 0)
      const deposit = Number(props.order?.deposit || 0)
      return parseFloat((dailyTotal + deposit).toFixed(2))
    }
    return 0
  })

  // 计算建议退款总金额
  const recommendedRefund = computed(() => {
    // 如果未入住，建议退还所有已支付金额
    if (!hasStayed.value) {
      return totalPaid.value
    }
    // 如果已入住，退还剩余天数的房费

    return recommendedBills.value.reduce((sum, item) => parseFloat((sum + Number(item.roomPrice)).toFixed(2)), 0)
  })

  // 建议退款的安全数值（保留两位小数，NaN/负值时兜底为0）
  const recommendedRefundRounded = computed(() => {
    const val = Number(recommendedRefund.value)
    if (!Number.isFinite(val) || val < 0) return 0
    return Number(val.toFixed(2))
  })

  // 可退款的房晚列表 (用于UI展示)
  const refundableNights = computed(() => recommendedBills.value)

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
    if (!props.order?.checkOutDate || !actualCheckoutTime.value) return false
    return new Date(actualCheckoutTime.value) >= new Date(props.order.checkOutDate)
  })

  // 表单提交按钮是否可用
  const canSubmit = computed(() => {
    if (!props.order) return false
    // 必须有退房时间且不能晚于原计划
    if (!actualCheckoutTime.value || showNotEarlyWarning.value) return false
    // 退款金额校验
    if (refundAmount.value === null || refundAmount.value === undefined) return false
    if (refundAmount.value < 0) return false
    if (refundAmount.value - recommendedRefundRounded.value > 0.01) return false
    // 必须选择退款方式
    if (!refundMethod.value) return false
    return true
  })

  // --- 辅助函数 ---



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

 /**
  * 加载订单关联的每日明细（total_price）
  * @returns {Array(Object)} 数组对象
  */
  async function loadOrderDetails() {
    const oid = props.order?.orderNumber || props.order?.order_id || props.order?.orderId
    if (!oid) {
      orderDailyRows.value = []
      return
    }
    try {
      loadingOrderDetails.value = true
      const orders = await orderStore.getOrderByNumber(oid)
      console.log('获取订单明细:', orders)
      const roomPrices = [];
      orders.forEach(order => {
        if (order.total_price !== undefined) {
          roomPrices.push({
            stayDate: order.stay_date,
            roomPrice: Number(order.total_price)
          });
        }
      });
      orderDailyRows.value = roomPrices;
    } catch (error) {
      orderDailyRows.value = []
      console.warn('加载订单明细失败:', error.message || error)
    } finally {
      loadingOrderDetails.value = false
    }
  }

  // 初始化表单数据
  function initializeForm() {
    if (!props.order) return
    hasStayed.value = true
    const now = new Date()
    const planned = props.order.checkOutDate ? new Date(props.order.checkOutDate) : null
    let base = now
    // 如果当前时间已经超过原计划退房时间，默认显示原计划时间前一小时 (逻辑上不太可能发生，作为兜底)
    if (planned && now >= planned) {
      base = new Date(planned.getTime() - 60 * 60 * 1000)
    }
    actualCheckoutTime.value = formatForInput(base)
    refundMethod.value = props.order.paymentMethod || viewStore.paymentMethodOptions?.[0]?.value || '现金'
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

  // --- 监听器 ---

  // 监听弹窗打开，初始化数据
  watch(
    () => props.modelValue,
    async (val) => {
      if (val) {
        initializeForm()
        await loadOrderDetails()
        // 初始加载完成后，自动填入建议金额
        applySuggestedAmountIfUntouched()
      } else {
        orderDailyRows.value = []
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

  // 弹窗开启且明细加载完成后，再次同步推荐金额（防止初次加载时因异步造成0）
  watch(
    () => [props.modelValue, loadingOrderDetails.value],
    ([visible, loading]) => {
      if (!visible || loading) return
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
    canSubmit,
    // actions
    formatDate,
    setActualCheckoutToNow,
    useRecommendedAmount,
    closeDialog,
    handleSubmit
  }
}
