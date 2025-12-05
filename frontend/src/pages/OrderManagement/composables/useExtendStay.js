import { ref } from 'vue'
import { useQuasar } from 'quasar'
import Decimal from 'decimal.js'
import { orderApi } from 'src/api'
import { useRoomStore } from 'src/stores/roomStore'
import { useViewStore } from 'src/stores/viewStore'
import { useOrderStore } from 'src/stores/orderStore'

export function useExtendStay(refreshAllData) {
  const $q = useQuasar()
  const roomStore = useRoomStore()
  const viewStore = useViewStore()
  const orderStore = useOrderStore()

  // 状态
  const showExtendStayDialog = ref(false)
  const extendStayOrder = ref(null)
  const extendStayRoomOptions = ref([])
  const loadingExtendStayRooms = ref(false)

  const toDecimal = (val) => {
    try { return new Decimal(val || 0) } catch (e) { return new Decimal(0) }
  }
  const toAmountNumber = (val) => Number(toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())

  // 打开对话框
  async function openExtendStayDialog(order) {
    const canExtend = ['checked-in', 'checked-out'].includes(order?.status)
    if (!order || !canExtend) {
      $q.notify({ type: 'negative', message: '只有已入住或已退房的订单才能办理续住', position: 'top' })
      return
    }

    extendStayOrder.value = order
    loadingExtendStayRooms.value = true

    try {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      const rooms = await roomStore.getAvailableRoomsByDate(today, tomorrowStr)

      extendStayRoomOptions.value = rooms.map(room => ({
        label: `${room.room_number} - ${viewStore.getRoomTypeName(room.type_code)} (¥${room.price}/晚)`,
        value: room.room_number,
        type: room.type_code,
        price: room.price
      }))

      showExtendStayDialog.value = true
    } catch (error) {
      $q.notify({ type: 'negative', message: '获取可用房间列表失败: ' + (error.message || '未知错误'), position: 'top' })
    } finally {
      loadingExtendStayRooms.value = false
    }
  }

  // 刷新房间列表（当日期改变时）
  async function handleRefreshExtendStayRooms(dateRange) {
    if (!dateRange.startDate || !dateRange.endDate) return
    loadingExtendStayRooms.value = true
    try {
      const rooms = await roomStore.getAvailableRoomsByDate(dateRange.startDate, dateRange.endDate)
      extendStayRoomOptions.value = rooms.map(room => ({
        label: `${room.room_number} - ${viewStore.getRoomTypeName(room.type_code)} (¥${room.price}/晚)`,
        value: room.room_number,
        type: room.type_code,
        price: room.price
      }))
    } catch (error) {
      $q.notify({ type: 'negative', message: '刷新可用房间列表失败', position: 'top' })
    } finally {
      loadingExtendStayRooms.value = false
    }
  }

  // 提交续住
  async function handleExtendStay(extendStayData) {
    try {
      const newOrderNumber = extendStayData.orderNumber
      const timestamp = Date.now()
      const uniqueId = String(timestamp).slice(-4)
      const extendStayGuestName = `${extendStayData.guestName}[续${uniqueId}]`

      const normalizedRoomPrice = (() => {
        const priceData = extendStayData.roomPrice
        if (priceData && typeof priceData === 'object' && !Array.isArray(priceData)) return { ...priceData }
        const nightlyTotal = typeof priceData === 'number' ? toDecimal(priceData) : toDecimal(extendStayData.totalPrice)
        const checkInDate = extendStayData.checkInDate
        if (checkInDate && nightlyTotal.gt(0)) {
          return { [checkInDate]: toAmountNumber(nightlyTotal) }
        }
        return {}
      })()

      const newOrderData = {
        orderId: newOrderNumber,
        sourceNumber: extendStayData.originalOrderNumber || '',
        orderSource: extendStayData.orderSource || '续住',
        guestName: extendStayGuestName,
        phone: extendStayData.phone,
        roomType: extendStayData.roomType,
        roomNumber: extendStayData.roomNumber,
        checkInDate: extendStayData.checkInDate,
        checkOutDate: extendStayData.checkOutDate,
        status: 'pending',
        paymentMethod: extendStayData.paymentMethod || 'cash',
        roomPrice: normalizedRoomPrice,
        deposit: 0,
        stayType: extendStayData.stayType || '客房',
        isPrepaid: false,
        prepaidAmount: 0,
        createTime: new Date().toISOString(),
        remarks: `续住订单，原客人：${extendStayData.guestName}，原订单号：${extendStayData.originalOrderNumber}。${extendStayData.notes || ''}`.trim(),
        source: 'extend_stay'
      }

      const createdOrder = await orderApi.addOrder(newOrderData)

      if (createdOrder) {
        showExtendStayDialog.value = false
        await refreshAllData()

        $q.notify({
          type: 'positive',
          message: `续住订单创建成功！\n订单号：${newOrderNumber}`,
          position: 'top',
          timeout: 5000,
          actions: [
            {
              label: '查看订单', color: 'white',
              handler: async () => { await orderStore.getOrderByNumber(newOrderNumber) }
              // 注意：这里由于解耦，没法直接调用 viewOrderDetails，只能简单通知或后续在 ViewOrders 处理
            }
          ]
        })
      }
    } catch (error) {
      console.error('创建续住订单失败:', error)
      const errorMessage = error.response?.data?.message || error.message || '未知错误'
      $q.notify({ type: 'negative', message: `创建续住订单失败: ${errorMessage}`, position: 'top', multiLine: true })
    }
  }

  return {
    showExtendStayDialog,
    extendStayOrder,
    extendStayRoomOptions,
    loadingExtendStayRooms,
    openExtendStayDialog,
    handleExtendStay,
    handleRefreshExtendStayRooms
  }
}
