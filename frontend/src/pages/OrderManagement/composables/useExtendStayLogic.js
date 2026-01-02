// src/pages/OrderManagement/composables/useExtendStayLogic.js
import { ref, computed, watch } from 'vue'
import { date } from 'quasar'
import Decimal from 'decimal.js'
import { useViewStore } from 'src/stores/viewStore'

/**
 * 续住表单逻辑，集中处理字段、校验与提交数据拼装。
 * @param {Object} params
 * @param {Ref<Boolean>} params.modelValueRef - dialog 显隐
 * @param {Ref<Object>} params.currentOrderRef - 当前订单
 * @param {Ref<Array>} params.availableRoomOptionsRef - 可选房间
 * @param {Function} params.emit - 组件 emit
 */
export function useExtendStayLogic({ modelValueRef, currentOrderRef, availableRoomOptionsRef, emit }) {
  const viewStore = useViewStore()

  const toDecimal = (val) => {
    try { return new Decimal(val || 0) } catch { return new Decimal(0) }
  }
  const toAmountNumber = (val) => Number(toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())

  // 响应式字段
  const selectedRoom = ref(null)
  const extendStartDate = ref('')
  const extendEndDate = ref('')
  const guestName = ref('')
  const guestPhone = ref('')
  const notes = ref('')
  const submitting = ref(false)
  const newOrderNumber = ref('')
  const paymentMethod = ref('')
  const customUnitPrice = ref(0)
  const userModifiedPrice = ref(false)
  const dailyPrices = ref({})

  const paymentMethodOptions = computed(() => viewStore.paymentMethodOptions)

  const singlePriceRules = [
    val => val !== null && val !== undefined && val !== '' || '请输入房价',
    val => toDecimal(val).gt(0) || '房价必须大于0'
  ]

  const today = computed(() => date.formatDate(new Date(), 'YYYY-MM-DD'))

  const selectedRoomInfo = computed(() => {
    if (!selectedRoom.value || !availableRoomOptionsRef?.value) return null
    const option = availableRoomOptionsRef.value.find(opt => opt.value === selectedRoom.value)
    return option ? { price: option.price, type: option.type } : null
  })

  const stayDays = computed(() => {
    if (!extendStartDate.value || !extendEndDate.value) return 0
    const diffDays = date.getDateDiff(extendEndDate.value, extendStartDate.value, 'days')
    return diffDays > 0 ? diffDays : 0
  })

  const stayDateList = computed(() => {
    if (!extendStartDate.value || !extendEndDate.value) return []
    const res = []
    const start = extendStartDate.value
    const end = extendEndDate.value
    const total = date.getDateDiff(end, start, 'days')
    for (let i = 0; i < total; i++) {
      res.push(date.formatDate(date.addToDate(start, { days: i }), 'YYYY-MM-DD'))
    }
    return res
  })

  const totalPrice = computed(() => {
    if (!selectedRoomInfo.value || !stayDays.value) return 0
    if (stayDays.value === 1) {
      const unit = toDecimal(customUnitPrice.value)
      return toAmountNumber(unit)
    }
    const sum = Object.values(dailyPrices.value)
      .reduce((acc, v) => acc.plus(toDecimal(v)), new Decimal(0))
    return toAmountNumber(sum)
  })

  const originalRoomAvailable = computed(() => {
    if (!currentOrderRef?.value?.roomNumber || !availableRoomOptionsRef?.value) return false
    return availableRoomOptionsRef.value.some(option => option.value === currentOrderRef.value.roomNumber)
  })

  const canConfirm = computed(() => {
    const phoneValid = !guestPhone.value || guestPhone.value.trim().length === 11
    if (!(selectedRoom.value && extendStartDate.value && extendEndDate.value && guestName.value.trim() && phoneValid && newOrderNumber.value.trim() && paymentMethod.value && stayDays.value > 0)) return false
    if (stayDays.value === 1) return toDecimal(customUnitPrice.value).gt(0)
    const dates = stayDateList.value
    if (!dates.length) return false
    return dates.every(d => toDecimal(dailyPrices.value[d]).gt(0))
  })

  // 监听日期变化刷新房间，并在范围变化时重置选择
  watch([extendStartDate, extendEndDate], ([newStartDate, newEndDate]) => {
    if (newStartDate && newEndDate && newStartDate < newEndDate) {
      emit?.('refresh-rooms', { startDate: newStartDate, endDate: newEndDate })
      if (selectedRoom.value === currentOrderRef?.value?.roomNumber) {
        setTimeout(() => {
          if (!originalRoomAvailable.value) selectedRoom.value = null
        }, 300)
      } else {
        selectedRoom.value = null
      }
    }
  })

  // 房间变动时填充默认价格
  watch(selectedRoomInfo, (info) => {
    if (info) {
      if (!userModifiedPrice.value && (!customUnitPrice.value || customUnitPrice.value <= 0)) {
        customUnitPrice.value = info.price
      }
      if (stayDateList.value.length > 0) {
        const updated = { ...dailyPrices.value }
        stayDateList.value.forEach(d => {
          if (!updated[d] || parseFloat(updated[d]) <= 0) {
            updated[d] = userModifiedPrice.value ? customUnitPrice.value : info.price
          }
        })
        dailyPrices.value = updated
      }
    } else if (!userModifiedPrice.value && (!customUnitPrice.value || customUnitPrice.value <= 0)) {
      customUnitPrice.value = 0
    }
  })

  // 日期列表变化时维护每日价格
  watch(stayDateList, (list) => {
    const current = { ...dailyPrices.value }
    Object.keys(current).forEach(k => { if (!list.includes(k)) delete current[k] })
    const defaultPrice = selectedRoomInfo.value?.price || toAmountNumber(customUnitPrice.value) || 0
    list.forEach(d => {
      if (current[d] === undefined) current[d] = defaultPrice
    })
    dailyPrices.value = current
  }, { immediate: true })

  // 打开/关闭对话框时初始化或重置
  watch(modelValueRef, (newVal) => {
    if (newVal && currentOrderRef?.value) {
      guestName.value = currentOrderRef.value.guestName || ''
      guestPhone.value = currentOrderRef.value.phone || ''
      extendStartDate.value = today.value
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      extendEndDate.value = date.formatDate(tomorrow, 'YYYY-MM-DD')
      selectedRoom.value = null
      notes.value = ''
      submitting.value = false
      paymentMethod.value = currentOrderRef.value.paymentMethod || viewStore.paymentMethodOptions[0]?.value || ''
      generateNewOrderNumber()
      setTimeout(() => {
        emit?.('refresh-rooms', { startDate: extendStartDate.value, endDate: extendEndDate.value })
      }, 100)
      try {
        const rp = currentOrderRef.value.roomPrice
        if (rp && typeof rp === 'object') {
          const keys = Object.keys(rp).sort()
          if (keys.length) {
            customUnitPrice.value = toAmountNumber(rp[keys[keys.length - 1]]) || toAmountNumber(rp[keys[0]]) || 0
          }
        } else if (typeof rp === 'number') {
          customUnitPrice.value = toAmountNumber(rp)
        }
      } catch (e) {
        customUnitPrice.value = selectedRoomInfo.value?.price || 0
      }
    } else if (!newVal) {
      resetForm()
    }
  })

  function resetForm() {
    selectedRoom.value = null
    extendStartDate.value = ''
    extendEndDate.value = ''
    guestName.value = ''
    guestPhone.value = ''
    notes.value = ''
    submitting.value = false
    newOrderNumber.value = ''
    paymentMethod.value = ''
    customUnitPrice.value = 0
    userModifiedPrice.value = false
    dailyPrices.value = {}
  }

  function generateNewOrderNumber() {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const timestamp = now.getTime()
    const uniqueId = String(timestamp).slice(-4)
    const originalNumber = currentOrderRef?.value?.orderNumber || 'ORDER'
    const shortOriginal = originalNumber.substring(0, 4)
    newOrderNumber.value = `${shortOriginal}EXT${month}${day}${hour}${minute}${second}${uniqueId}`.slice(0, 20)
  }

  function selectOriginalRoom() {
    if (currentOrderRef?.value?.roomNumber) {
      selectedRoom.value = currentOrderRef.value.roomNumber
    }
  }

  function recalcTotal() { /* 计算由 totalPrice 负责，这里占位保持接口 */ }

  function formatDay(str) {
    if (!str) return ''
    try {
      const d = new Date(str)
      return `${d.getMonth() + 1}-${d.getDate()}`
    } catch {
      return str
    }
  }

  async function confirmExtendStay() {
    if (!canConfirm.value) return
    submitting.value = true
    try {
      const extendStayData = {
        orderNumber: newOrderNumber.value.trim(),
        originalOrderNumber: currentOrderRef.value.orderNumber,
        roomNumber: selectedRoom.value,
        roomType: selectedRoomInfo.value?.type,
        roomPrice: stayDays.value === 1
          ? (toAmountNumber(customUnitPrice.value) || selectedRoomInfo.value?.price)
          : Object.fromEntries(Object.entries(dailyPrices.value).map(([k, v]) => [k, toAmountNumber(v)])),
        checkInDate: extendStartDate.value,
        checkOutDate: extendEndDate.value,
        guestName: guestName.value.trim(),
        phone: guestPhone.value.trim(),
        idNumber: currentOrderRef.value.idNumber,
        paymentMethod: paymentMethod.value,
        totalPrice: totalPrice.value,
        stayDays: stayDays.value,
        notes: notes.value.trim(),
        orderSource: currentOrderRef.value?.orderSource || '续住',
        stayType: currentOrderRef.value?.stayType || '客房',
        originalGuestName: currentOrderRef.value.guestName,
        originalRoomNumber: currentOrderRef.value.roomNumber,
        originalCheckOutDate: currentOrderRef.value.checkOutDate
      }
      emit?.('extend-stay', extendStayData)
    } finally {
      submitting.value = false
    }
  }

  return {
    selectedRoom,
    extendStartDate,
    extendEndDate,
    guestName,
    guestPhone,
    notes,
    submitting,
    newOrderNumber,
    paymentMethod,
    customUnitPrice,
    userModifiedPrice,
    dailyPrices,
    paymentMethodOptions,
    today,
    selectedRoomInfo,
    stayDays,
    totalPrice,
    canConfirm,
    originalRoomAvailable,
    stayDateList,
    singlePriceRules,
    // methods
    generateNewOrderNumber,
    selectOriginalRoom,
    recalcTotal,
    formatDay,
    confirmExtendStay
  }
}
