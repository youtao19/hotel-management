/* 这个文件将接管 RoomCalendarDialog.vue 内部的复杂逻辑（数据获取、颜色计算）。 */
import { ref, computed } from 'vue'
import { useOrderStore } from 'src/stores/orderStore'

export function useRoomCalendar() {
  const orderStore = useOrderStore()

  // --- 状态 ---
  const currentRoom = ref(null)
  const roomBookingData = ref([])
  const calendarDate = ref(new Date().toISOString().substr(0, 10))
  const selectedDateInfo = ref(null)
  const currentCalendarView = ref({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  })

  // --- 核心逻辑：获取某房间某月的数据 ---
  const fetchMonthData = async (room, year, month) => {
    if (!room) return
    currentRoom.value = room

    // 更新当前视图状态（这很重要，roomCalendarEvents 依赖这个值）
    currentCalendarView.value = { year, month }

    // 计算当月起止日期
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    try {
      roomBookingData.value = []

      // 确保订单数据已加载（如果没有订单数据则先获取）
      if (!orderStore.orders || orderStore.orders.length === 0) {
        console.log('[RoomCalendar] 订单数据为空，正在获取...')
        await orderStore.fetchAllOrders()
      }

      const orders = orderStore.orders || []
      const roomNumber = String(room.room_number) // 统一转为字符串比较

      console.log(`[RoomCalendar] 房间 ${roomNumber} 在 ${startDate} ~ ${endDate} 的日历数据`)
      console.log(`[RoomCalendar] 总订单数: ${orders.length}`)

      // 1. 筛选该房间的订单（统一转为字符串比较）
      const roomOrders = orders.filter(order => {
        const orderRoomNumber = order.roomNumber != null ? String(order.roomNumber) : null
        return orderRoomNumber === roomNumber
      })
      console.log(`[RoomCalendar] 房间 ${roomNumber} 的订单数: ${roomOrders.length}`)

      // 2. 筛选日期范围重叠的订单（排除已取消和已退房的订单）
      const filteredOrders = roomOrders.filter(order => {
        if (!order.checkInDate || !order.checkOutDate) return false
        // 跳过已取消的订单
        if (order.status === 'cancelled' || order.status === '已取消') return false

        const checkIn = new Date(order.checkInDate)
        const checkOut = new Date(order.checkOutDate)
        const start = new Date(startDate)
        const end = new Date(endDate)

        // 检查日期范围是否重叠
        return (checkIn >= start && checkIn <= end) ||
               (checkOut >= start && checkOut <= end) ||
               (checkIn <= start && checkOut >= end)
      })

      console.log(`[RoomCalendar] 日期范围内的订单数: ${filteredOrders.length}`)
      if (filteredOrders.length > 0) {
        console.log('[RoomCalendar] 订单详情:', filteredOrders.map(o => ({
          orderNumber: o.orderNumber,
          checkIn: o.checkInDate,
          checkOut: o.checkOutDate,
          status: o.status,
          guest: o.guestName
        })))
      }

      // 3. 映射为简单数据结构
      if (filteredOrders.length > 0) {
        roomBookingData.value = filteredOrders.map(order => {
          let status = order.status
          // 状态归一化
          if (status === '待入住' || status === 'pending' || status === 'reserved') status = 'pending'
          else if (status === '已入住' || status === 'checked-in' || status === 'occupied') status = 'checked-in'
          else if (status === '已退房' || status === 'checked-out') status = 'checked-out'

          return {
            check_in_date: order.checkInDate,
            check_out_date: order.checkOutDate,
            status: status,
            guest_name: order.guestName
          }
        })
      }
    } catch (error) {
      console.error('[RoomCalendar] 获取日历数据失败', error)
    }
  }

  // --- 核心逻辑：判断某天的状态 ---
  const getRoomDateStatus = (dateStr) => {
    if (!roomBookingData.value.length) return 'available'

    for (const booking of roomBookingData.value) {
      const checkIn = new Date(booking.check_in_date).toISOString().substr(0, 10)
      const checkOut = new Date(booking.check_out_date).toISOString().substr(0, 10)

      // 区间判断
      if (dateStr >= checkIn && dateStr < checkOut) {
        if (booking.status === 'checked-in') return 'occupied'
        if (booking.status === 'pending') return 'reserved'
        if (booking.status === 'checked-out') return 'occupied' // 历史记录
      }
      // 特殊处理：当天入住当天退房
      if (checkIn === checkOut && dateStr === checkIn) {
         return booking.status === 'checked-in' ? 'occupied' : 'reserved'
      }
    }
    return 'available'
  }

  // --- 辅助方法：生成日历事件点 ---
  // 始终为当月所有日期生成事件，这样即使没有订单也能显示"可用"状态
  const roomCalendarEvents = computed(() => {
    const events = []
    const { year, month } = currentCalendarView.value
    const daysInMonth = new Date(year, month, 0).getDate()

    for (let i = 1; i <= daysInMonth; i++) {
      // Quasar 日历格式 YYYY/MM/DD
      const dateStr = `${year}/${String(month).padStart(2, '0')}/${String(i).padStart(2, '0')}`
      events.push(dateStr)
    }
    return events
  })

  // --- 辅助方法：计算颜色 ---
  const getEventColor = (timestamp) => {
    const dateStr = timestamp.replace(/\//g, '-')
    const status = getRoomDateStatus(dateStr)
    switch (status) {
      case 'occupied': return 'red'
      case 'reserved': return 'blue'
      case 'available': return 'green'
      default: return 'grey'
    }
  }

  // --- 交互：选中日期 ---
  const handleDateSelect = (date) => {
    if (!date) return
    const dateStr = typeof date === 'string' ? date.replace(/\//g, '-') : date.toISOString().substr(0, 10)
    const status = getRoomDateStatus(dateStr)

    // 查找该日期的订单信息
    const booking = roomBookingData.value.find(b => {
       const checkIn = new Date(b.check_in_date).toISOString().substr(0, 10)
       const checkOut = new Date(b.check_out_date).toISOString().substr(0, 10)
       return dateStr >= checkIn && dateStr < checkOut
    })

    selectedDateInfo.value = {
      date: dateStr,
      statusText: status === 'occupied' ? '已入住' : status === 'reserved' ? '已预订' : '可入住',
      color: status === 'occupied' ? 'red' : status === 'reserved' ? 'blue' : 'green',
      guestName: booking?.guest_name
    }
  }

  return {
    currentRoom,
    roomBookingData,
    calendarDate,
    selectedDateInfo,
    currentCalendarView,

    fetchMonthData,
    getEventColor,
    handleDateSelect,
    roomCalendarEvents
  }
}
