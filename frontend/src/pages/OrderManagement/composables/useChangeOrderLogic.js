// src/pages/OrderManagement/composables/useChangeOrderLogic.js
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import Decimal from 'decimal.js'
import { billApi, orderApi } from 'src/api'
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
  // 账单数据
  const billData = ref([])

  // Decimal 工具函数，用于处理金额计算，避免浮点数精度问题
  const toDecimal = (val) => {
    try { return new Decimal(val || 0) } catch { return new Decimal(0) }
  }
  // 将数值转换为两位小数的数字类型，采用四舍五入策略
  const toAmountNumber = (val) => Number(toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())

  /**
   * 格式化数据库日期字符串为 YYYY-MM-DD 格式
   * @param {string} dateString - 数据库返回的日期字符串
   * @returns {string} 格式化后的日期字符串
   */
  function formatDateFromDB(dateString) {
    if (!dateString) return ''
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  /**
   * 获取入住期间的所有日期列表（不包含退房日）
   * @param {string} checkIn - 入住日期 YYYY-MM-DD
   * @param {string} checkOut - 退房日期 YYYY-MM-DD
   * @returns {string[]} 日期字符串数组
   */
  function getStayDates(checkIn, checkOut) {
    if (!checkIn) return []
    const format = (dateObj) => `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
    const start = new Date(`${checkIn}T00:00:00`)
    const end = checkOut ? new Date(`${checkOut}T00:00:00`) : null
    if (Number.isNaN(start.getTime())) return []
    // 如果没有退房日期或退房日期早于入住日期，仅返回入住日期
    if (!end || Number.isNaN(end.getTime()) || end <= start) return [format(start)]
    const dates = []
    const cursor = new Date(start)
    // 遍历日期，直到退房日（不包含退房日）
    while (cursor < end) {
      dates.push(format(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return dates
  }

  const paymentMethodOptions = computed(() => viewStore.paymentMethodOptions)

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
    const sum = Object.values(editableOrder.value.roomPrice).reduce((acc, price) => acc.plus(toDecimal(price)), new Decimal(0))
    return toAmountNumber(sum)
  })

  /**
   * 格式化日期用于显示（M月D日）
   */
  function formatDay(dateStr) {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return `${d.getMonth() + 1}月${d.getDate()}日`
    } catch { return dateStr }
  }

  function reset() {
    editableOrder.value = null
    originalRoomNumber.value = null
    billData.value = []
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
    // 深拷贝订单数据
    const clonedOrder = JSON.parse(JSON.stringify(newOrder))
    // 截取日期字符串的日期部分
    clonedOrder.checkInDate = clonedOrder.checkInDate ? clonedOrder.checkInDate.split('T')[0] : ''
    clonedOrder.checkOutDate = clonedOrder.checkOutDate ? clonedOrder.checkOutDate.split('T')[0] : ''

    // 初始房费来源优先级：dailyOrders -> roomPrice对象 -> 数值 total_price/roomPrice 平均分
    const initialRoomPrice = {}
    const stayDates = getStayDates(clonedOrder.checkInDate, clonedOrder.checkOutDate)

    // 策略1：如果存在每日订单详情，优先使用
    if (Array.isArray(clonedOrder.dailyOrders) && clonedOrder.dailyOrders.length) {
      clonedOrder.dailyOrders.forEach(d => {
        if (d.stayDate) initialRoomPrice[d.stayDate] = toAmountNumber(d.price)
      })
    }
    // 策略2：如果 roomPrice 是对象，直接使用
    else if (clonedOrder.roomPrice && typeof clonedOrder.roomPrice === 'object' && !Array.isArray(clonedOrder.roomPrice)) {
      Object.entries(clonedOrder.roomPrice).forEach(([k, v]) => { initialRoomPrice[k] = toAmountNumber(v) })
    }
    // 策略3：如果只有总价，则平均分配到每一天
    else if (stayDates.length) {
      const total = toDecimal(clonedOrder.total_price ?? clonedOrder.roomPrice ?? 0)
      const avg = stayDates.length ? total.div(stayDates.length) : total
      let cumulated = new Decimal(0)
      stayDates.forEach((date, index) => {
        // 最后一天使用减法，确保总和等于总价，避免除法精度误差
        const baseValue = index === stayDates.length - 1 ? total.minus(cumulated) : avg
        const normalized = toAmountNumber(baseValue)
        initialRoomPrice[date] = normalized
        cumulated = cumulated.plus(normalized)
      })
    }

    clonedOrder.roomPrice = initialRoomPrice

    // 设置默认支付方式
    clonedOrder.paymentMethod = clonedOrder.paymentMethod || viewStore.paymentMethodOptions[0]?.value || ''

    editableOrder.value = clonedOrder
    originalRoomNumber.value = newOrder.roomNumber

    try {
      // 获取账单详情以获取准确的押金信息
      // 注意：房费不再从账单获取，完全依赖订单数据
      const response = await billApi.getOrderBillDetails(newOrder.orderNumber)
      const data = response?.data?.data || response?.data || response || []
      const bills = Array.isArray(data) ? data : []
      billData.value = bills

      let totalDeposit = new Decimal(0)

      // 累加所有账单中的押金
      bills.forEach(bill => {
        totalDeposit = totalDeposit.plus(toDecimal(bill.deposit))
      })

      if (editableOrder.value) {
        // 仅更新押金，房费完全依赖订单数据
        if (totalDeposit.gt(0)) {
          editableOrder.value.deposit = toAmountNumber(totalDeposit)
        }
      }
    } catch (error) {
      billData.value = []
      $q.notify({ type: 'negative', message: '获取账单详情失败' })
      console.error('获取账单详情错误:', error)
    }

    // 确保房费覆盖所有入住日期（处理可能存在的日期缺失）
    editableOrder.value.roomPrice = fillMissingRoomPrice(
      distributeIfSingleDayTotal(editableOrder.value.roomPrice || {}, stayDates),
      clonedOrder.checkInDate,
      clonedOrder.checkOutDate,
      Object.values(initialRoomPrice).reduce((acc, v) => acc.plus(toDecimal(v)), new Decimal(0))
    )
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

    // 重新计算每日房价
    const stayDates = getStayDates(editableOrder.value.checkInDate, editableOrder.value.checkOutDate)
    if (!stayDates.length) return
    const updatedPrices = {}
    stayDates.forEach(date => { updatedPrices[date] = toAmountNumber(selectedRoom.price) })
    editableOrder.value.roomPrice = updatedPrices
  }

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
      // 计算总价：累加每日房费
      const totalPrice = toAmountNumber(Object
        .values(editableOrder.value.roomPrice || {})
        .reduce((sum, price) => sum.plus(toDecimal(price || 0)), new Decimal(0)))

      // 构建订单主数据
      const orderData = {
        guest_name: editableOrder.value.guestName,
        phone: editableOrder.value.phone,
        id_number: editableOrder.value.idNumber,
        room_type: editableOrder.value.roomType,
        room_number: editableOrder.value.roomNumber,
        remarks: editableOrder.value.remarks,
        deposit: toAmountNumber(editableOrder.value.deposit),
        total_price: totalPrice,
        payment_method: editableOrder.value.paymentMethod
      }

      // 计算账单更新
      const billUpdates = {}
      const originalBillsByDate = {}
      // 建立日期到原始账单的映射
      billData.value.forEach(bill => {
        const date = formatDateFromDB(bill.stay_date)
        if (date) originalBillsByDate[date] = bill
      })

      // 检查每日房费是否有变化，如果有变化则记录到 billUpdates
      Object.keys(editableOrder.value.roomPrice || {}).forEach(date => {
        const newRoomFee = toDecimal(editableOrder.value.roomPrice[date])
        const originalBill = originalBillsByDate[date]
        if (originalBill) {
          const originalRoomFee = toDecimal(originalBill.room_fee)
          if (!newRoomFee.equals(originalRoomFee)) {
            billUpdates[date] = { room_fee: toAmountNumber(newRoomFee) }
          }
        }
      })

      // 检查押金是否有变化
      // 查找原始的押金账单（通常是第一笔或标记为订单账单的记录）
      const originalDepositBill = billData.value.find(bill => {
        const changeType = bill.change_type
        const isOrderBill = changeType === '订单账单' || changeType === null || changeType === ''
        return isOrderBill && bill.deposit !== null && bill.deposit !== undefined && toDecimal(bill.deposit).gt(0)
      })

      if (originalDepositBill) {
        const originalDeposit = toDecimal(originalDepositBill.deposit)
        const newDeposit = toDecimal(editableOrder.value.deposit)
        // 如果押金发生变化，更新对应的账单记录
        if (!newDeposit.equals(originalDeposit)) {
          const billDate = formatDateFromDB(originalDepositBill.stay_date)
          if (billDate) {
            billUpdates[billDate] = { ...(billUpdates[billDate] || {}), deposit: toAmountNumber(newDeposit) }
          }
        }
      }

      // 调用后端 API 进行联合更新
      await orderApi.updateOrderWithBills(
        editableOrder.value.orderNumber,
        orderData,
        billUpdates,
        'user'
      )

      $q.notify({ type: 'positive', message: '订单更新成功' })

      // 构建更新事件数据
      const updateEventData = {
        orderNumber: editableOrder.value.orderNumber,
        guestName: editableOrder.value.guestName,
        phone: editableOrder.value.phone,
        idNumber: editableOrder.value.idNumber,
        roomNumber: editableOrder.value.roomNumber,
        remarks: editableOrder.value.remarks,
        isRoomChanged: editableOrder.value.roomNumber !== originalRoomNumber.value,
        billsUpdated: Object.keys(billUpdates).length > 0
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

  /**
   * 填充缺失日期的房费
   * 确保入住期间的每一天都有对应的房费数据
   * 如果某天缺失，则使用已存在的非零房费或平均值进行填充
   */
  function fillMissingRoomPrice(roomPrice, checkInDate, checkOutDate, baseTotal) {
    const dates = getStayDates(checkInDate, checkOutDate)
    if (!dates.length) return roomPrice
    const existing = { ...roomPrice }
    // 找出所有非零的房费
    const nonZero = Object.values(existing).map(v => toDecimal(v)).filter(v => v.gt(0))
    // 计算平均房费
    const avg = dates.length ? toDecimal(baseTotal || 0).div(dates.length) : new Decimal(0)
    // 确定默认填充价格：优先使用已有的非零价格，否则使用平均价
    const defaultPrice = nonZero[0] || avg
    dates.forEach(d => {
      if (existing[d] === undefined) existing[d] = toAmountNumber(defaultPrice)
    })
    return existing
  }

  /**
   * 如果房费对象只有一个总价，则将其平均分配到每一天
   * 这种情况通常发生在旧数据或初始化时只提供了总价的情况
   */
  function distributeIfSingleDayTotal(roomPrice, stayDates) {
    const keys = Object.keys(roomPrice || {})
    // 如果没有入住日期，或者房费对象不只包含一个键，或者入住只有一天，则无需处理
    if (!stayDates?.length || keys.length !== 1 || stayDates.length === 1) return roomPrice
    const total = toDecimal(roomPrice[keys[0]] || 0)
    if (total.lte(0)) return roomPrice
    const res = {}
    const nights = stayDates.length
    const avg = total.div(nights)
    let cumulated = new Decimal(0)
    stayDates.forEach((date, index) => {
      // 最后一天使用减法，确保总和等于总价
      const baseValue = index === nights - 1 ? total.minus(cumulated) : avg
      const normalized = toAmountNumber(baseValue)
      res[date] = normalized
      cumulated = cumulated.plus(normalized)
    })
    return res
  }

  return {
    editableOrder,
    loading,
    paymentMethodOptions,
    roomOptions,
    totalRoomPrice,
    formatDay,
    handleRoomChange,
    submitChange
  }
}
