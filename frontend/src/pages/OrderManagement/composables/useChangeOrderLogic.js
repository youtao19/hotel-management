// src/pages/OrderManagement/composables/useChangeOrderLogic.js
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { orderApi } from 'src/api'
import { useViewStore } from 'src/stores/viewStore'

/**
 * 修改订单对话框逻辑，负责数据初始化、价格拆分与联合更新。
 * @param {Object} params
 * @param {Ref} params.modelValueRef - 控制对话框显示的 ref
 * @param {Ref} params.orderRef - 当前选中的订单 ref
 * @param {Ref} params.availableRoomsRef - 可用房间列表 ref
 * @param {Function} params.getRoomTypeName - 获取房型名称的函数
 * @param {Function} params.emit - Vue emit 函数
 */
export function useChangeOrderLogic({ modelValueRef, orderRef, availableRoomsRef, getRoomTypeName, emit }) {
  const $q = useQuasar()
  const viewStore = useViewStore()

  // 可编辑的订单对象副本
  const editableOrder = ref(null)
  // 原始房间号，用于判断是否换房
  const originalRoomNumber = ref(null)
  const loading = ref(false)

  const toAmountNumber = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return 0;
    return Number(n.toFixed(2));
  }

  const paymentMethodOptions = computed(() => viewStore.paymentMethodOptions)

  const normalizeMethod = (method) => {
    const normalized = viewStore.normalizePaymentMethodForDB(method)
    return normalized || viewStore.paymentMethodOptions[0]?.value || '现金'
  }

  const normalizeSplitRows = (rawSplits, fallbackMethod, fallbackAmount = 0) => {
    const rows = Array.isArray(rawSplits)
      ? rawSplits
        .map((split) => ({
          method: normalizeMethod(split?.method),
          amount: toAmountNumber(split?.amount)
        }))
        .filter((split) => split.amount > 0)
      : []
    if (rows.length) return rows
    const amount = toAmountNumber(fallbackAmount)
    if (amount <= 0) return []
    return [{ method: normalizeMethod(fallbackMethod), amount }]
  }

  const sanitizeSplitRows = (rawSplits) => {
    return (Array.isArray(rawSplits) ? rawSplits : [])
      .map((split) => ({
        method: normalizeMethod(split?.method),
        amount: toAmountNumber(split?.amount)
      }))
      .filter((split) => split.amount > 0)
  }

  // 生成房间选项列表，用于下拉选择
  // 格式：房间号 (房型) - ¥价格
  const roomOptions = computed(() => {
    if (!availableRoomsRef?.value) return []
    const resolver = getRoomTypeName || ((v) => v || '')
    return availableRoomsRef.value.map(room => ({
      label: `${room.room_number} (${resolver(room.type_code)}) - ¥${room.price}`,
      value: room.room_number,
      price: Number(room.price) || 0,
      type: room.type_code
    }))
  })

  // 计算总房费：累加每日房费
  const totalRoomPrice = computed(() => {
    if (!editableOrder.value?.roomPrice) return 0
    const sum = Object.values(editableOrder.value.roomPrice).reduce((acc, price) => acc + (Number(price) || 0), 0)
    return toAmountNumber(sum)
  })

  const roomFeeSplitTotal = computed(() => {
    return sanitizeSplitRows(editableOrder.value?.roomFeePaymentSplits).reduce((sum, split) => sum + split.amount, 0)
  })

  const depositSplitTotal = computed(() => {
    return sanitizeSplitRows(editableOrder.value?.depositPaymentSplits).reduce((sum, split) => sum + split.amount, 0)
  })

  /**
   * 格式化日期用于显示（M月D日）
   */
  function formatDay(dateStr) {
    if (!dateStr) return ''
    // 不使用 Date 对账务日期做解析，直接按 YYYY-MM-DD 字符串展示。
    const normalized = String(dateStr).slice(0, 10)
    const parts = normalized.split('-')
    if (parts.length !== 3) return normalized
    return `${Number(parts[1])}月${Number(parts[2])}日`
  }

  function reset() {
    editableOrder.value = null
    originalRoomNumber.value = null
  }

  /**
   * 初始化订单数据
   * 当对话框打开时调用，负责准备编辑所需的数据结构
   * 1. 克隆订单数据，避免直接修改原始数据
   * 2. 格式化日期
   * 3. 计算初始房费分布（优先级：dailyOrders > roomPrice对象 > 总价平均分）
   * 4. 获取账单详情，仅用于更新押金信息
   */
  async function initOrder(newOrder) {
    if (!newOrder) { reset(); return }
    const clonedOrder = JSON.parse(JSON.stringify(newOrder))
    clonedOrder.checkInDate = typeof clonedOrder.checkInDate === 'string' ? clonedOrder.checkInDate.split('T')[0] : ''
    clonedOrder.checkOutDate = typeof clonedOrder.checkOutDate === 'string' ? clonedOrder.checkOutDate.split('T')[0] : ''

    const dailyPrices = clonedOrder.dailyPrices || clonedOrder.daily_prices || null
    const roomPriceMap = (dailyPrices && typeof dailyPrices === 'object' && !Array.isArray(dailyPrices))
      ? dailyPrices
      : (clonedOrder.roomPrice && typeof clonedOrder.roomPrice === 'object' && !Array.isArray(clonedOrder.roomPrice) ? clonedOrder.roomPrice : {})

    clonedOrder.roomPrice = Object.fromEntries(
      Object.entries(roomPriceMap).map(([k, v]) => [String(k).slice(0, 10), toAmountNumber(v)])
    )

    clonedOrder.stayDates = Array.isArray(clonedOrder.stayDates) && clonedOrder.stayDates.length
      ? clonedOrder.stayDates
      : (Array.isArray(clonedOrder.stay_dates) && clonedOrder.stay_dates.length
          ? clonedOrder.stay_dates
          : Object.keys(clonedOrder.roomPrice || {}).sort())

    clonedOrder.paymentMethod = clonedOrder.paymentMethod || viewStore.paymentMethodOptions[0]?.value || ''
    clonedOrder.deposit = toAmountNumber(clonedOrder.deposit || 0)
    clonedOrder.roomFeePaymentSplits = normalizeSplitRows(
      clonedOrder.roomFeePaymentSplits,
      clonedOrder.paymentMethod,
      Object.values(clonedOrder.roomPrice || {}).reduce((sum, amount) => sum + (Number(amount) || 0), 0)
    )
    clonedOrder.depositPaymentSplits = normalizeSplitRows(
      clonedOrder.depositPaymentSplits,
      clonedOrder.paymentMethod,
      clonedOrder.deposit
    )

    editableOrder.value = clonedOrder
    originalRoomNumber.value = newOrder.roomNumber
  }

  watch(() => [orderRef?.value, modelValueRef?.value], ([newOrder, dialogOpen]) => {
    if (dialogOpen && newOrder) {
      initOrder(newOrder)
    }
    if (!dialogOpen) reset()
  }, { immediate: true })

  /**
   * 处理房间变更事件
   * 当用户在下拉框中选择新房间时触发
   * 1. 更新订单的房型信息
   * 2. 根据新房间的价格，更新每日房价
   */
  function handleRoomChange(newRoomNumber) {
    if (!editableOrder.value) return
    const selectedRoom = roomOptions.value.find(room => room.value === newRoomNumber)
    if (!selectedRoom) return
    // 更新房型
    editableOrder.value.roomType = selectedRoom.type || editableOrder.value.roomType

    const stayDates = Array.isArray(editableOrder.value.stayDates) && editableOrder.value.stayDates.length
      ? editableOrder.value.stayDates
      : Object.keys(editableOrder.value.roomPrice || {}).sort()
    if (!stayDates.length) return
    const updatedPrices = {}
    stayDates.forEach(date => { updatedPrices[date] = toAmountNumber(selectedRoom.price) })
    editableOrder.value.roomPrice = updatedPrices
  }

  function addRoomFeeSplitRow() {
    if (!editableOrder.value) return
    editableOrder.value.roomFeePaymentSplits = [
      ...(editableOrder.value.roomFeePaymentSplits || []),
      { method: normalizeMethod(editableOrder.value.paymentMethod), amount: 0 }
    ]
  }

  function removeRoomFeeSplitRow(index) {
    if (!editableOrder.value) return
    const rows = Array.isArray(editableOrder.value.roomFeePaymentSplits)
      ? editableOrder.value.roomFeePaymentSplits
      : []
    if (rows.length <= 1) return
    rows.splice(index, 1)
  }

  function addDepositSplitRow() {
    if (!editableOrder.value) return
    editableOrder.value.depositPaymentSplits = [
      ...(editableOrder.value.depositPaymentSplits || []),
      { method: normalizeMethod(editableOrder.value.paymentMethod), amount: 0 }
    ]
  }

  function removeDepositSplitRow(index) {
    if (!editableOrder.value) return
    const rows = Array.isArray(editableOrder.value.depositPaymentSplits)
      ? editableOrder.value.depositPaymentSplits
      : []
    if (rows.length <= 1) return
    rows.splice(index, 1)
  }

  watch(totalRoomPrice, (newTotal) => {
    if (!editableOrder.value) return
    const rows = Array.isArray(editableOrder.value.roomFeePaymentSplits)
      ? editableOrder.value.roomFeePaymentSplits
      : []
    // 仅在单条拆分时自动跟随金额变化，避免覆盖用户的多拆分输入。
    if (rows.length === 1) {
      rows[0].amount = toAmountNumber(newTotal)
      rows[0].method = normalizeMethod(rows[0].method || editableOrder.value.paymentMethod)
    }
  })

  watch(() => editableOrder.value?.deposit, (newDeposit) => {
    if (!editableOrder.value) return
    const rows = Array.isArray(editableOrder.value.depositPaymentSplits)
      ? editableOrder.value.depositPaymentSplits
      : []
    // 仅在单条拆分时自动跟随金额变化，避免覆盖用户的多拆分输入。
    if (rows.length === 1) {
      rows[0].amount = toAmountNumber(newDeposit)
      rows[0].method = normalizeMethod(rows[0].method || editableOrder.value.paymentMethod)
    }
  })

  watch(() => editableOrder.value?.paymentMethod, (newMethod) => {
    if (!editableOrder.value) return
    const normalized = normalizeMethod(newMethod)
    if (normalized !== newMethod) {
      editableOrder.value.paymentMethod = normalized
      return
    }
    const roomRows = Array.isArray(editableOrder.value.roomFeePaymentSplits)
      ? editableOrder.value.roomFeePaymentSplits
      : []
    const depositRows = Array.isArray(editableOrder.value.depositPaymentSplits)
      ? editableOrder.value.depositPaymentSplits
      : []
    // 默认支付方式变化时，单条拆分自动同步方法，多条拆分保持用户输入。
    if (roomRows.length === 1) roomRows[0].method = normalized
    if (depositRows.length === 1) depositRows[0].method = normalized
  })

  /**
   * 提交订单修改
   * 1. 计算总价
   * 2. 构建订单更新数据对象
   * 3. 比较新旧房费，生成账单更新数据
   * 4. 比较新旧押金，生成账单更新数据
   * 5. 调用 API 更新订单和账单
   * 6. 发送事件通知父组件
   */
  async function submitChange() {
    if (!editableOrder.value) return
    loading.value = true
    try {
      const orderData = {
        guest_name: editableOrder.value.guestName,
        phone: editableOrder.value.phone,
        room_type: editableOrder.value.roomType,
        room_number: editableOrder.value.roomNumber,
        remarks: editableOrder.value.remarks,
        deposit: toAmountNumber(editableOrder.value.deposit),
        payment_method: normalizeMethod(editableOrder.value.paymentMethod)
      }
      const roomFeePaymentSplits = sanitizeSplitRows(editableOrder.value.roomFeePaymentSplits)
      const depositPaymentSplits = sanitizeSplitRows(editableOrder.value.depositPaymentSplits)
      const paymentSplitPayload = {
        // 将多支付方式拆分交给后端统一校验与落账，前端仅做录入。
        roomFeePaymentSplits,
        depositPaymentSplits,
        depositPaymentMethod: depositPaymentSplits[0]?.method || normalizeMethod(editableOrder.value.paymentMethod)
      }

      await orderApi.updateOrderWithBillsV2(
        editableOrder.value.orderNumber,
        orderData,
        editableOrder.value.roomPrice || {},
        'user',
        paymentSplitPayload
      )

      $q.notify({ type: 'positive', message: '订单更新成功' })

      // 构建更新事件数据
      const updateEventData = {
        orderNumber: editableOrder.value.orderNumber,
        guestName: editableOrder.value.guestName,
        phone: editableOrder.value.phone,
        roomNumber: editableOrder.value.roomNumber,
        remarks: editableOrder.value.remarks,
        isRoomChanged: editableOrder.value.roomNumber !== originalRoomNumber.value,
        billsUpdated: true
      }

      emit?.('order-updated', updateEventData)
      emit?.('update:modelValue', false)
    } catch (error) {
      $q.notify({ type: 'negative', message: '更新订单失败' })
      console.error('联合更新订单失败:', error)
    } finally {
      loading.value = false
    }
  }

  return {
    editableOrder,
    loading,
    paymentMethodOptions,
    roomOptions,
    totalRoomPrice,
    roomFeeSplitTotal,
    depositSplitTotal,
    formatDay,
    handleRoomChange,
    addRoomFeeSplitRow,
    removeRoomFeeSplitRow,
    addDepositSplitRow,
    removeDepositSplitRow,
    submitChange
  }
}
