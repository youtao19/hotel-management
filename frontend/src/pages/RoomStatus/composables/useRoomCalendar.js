/* 这个文件将接管 RoomCalendarDialog.vue 内部的复杂逻辑（数据获取、颜色计算）。 */
import { ref, computed } from 'vue'
import { roomApi } from 'src/api'

export function useRoomCalendar() {
  // --- 状态 ---
  const currentRoom = ref(null)
  // 改用每日房态数据结构：Map<日期字符串, {status, guest_name, order_id}>
  const roomBookingData = ref([])
  // 存储每日房态详情：{ 'YYYY-MM-DD': { status, guest_name, order_id } }
  const dailyRoomStatus = ref({})
  const calendarDate = ref(new Date().toISOString().substr(0, 10))
  const selectedDateInfo = ref(null)
  const currentCalendarView = ref({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  })

  // --- 核心逻辑：获取某房间某月的数据 ---
  // 改为使用后端的每日房态 API，确保准确反映每日房间安排的换房情况
  const fetchMonthData = async (room, year, month) => {
    if (!room) return
    currentRoom.value = room

    // 更新当前视图状态（这很重要，roomCalendarEvents 依赖这个值）
    currentCalendarView.value = { year, month }

    // 计算当月起止日期
    const lastDay = new Date(year, month, 0).getDate()
    const roomNumber = String(room.room_number)

    console.log(`[RoomCalendar] 开始获取房间 ${roomNumber} 在 ${year}-${month} 的每日房态`)

    try {
      // 清空旧数据
      roomBookingData.value = []
      dailyRoomStatus.value = {}

      // 批量获取该月每一天的房态数据
      // 使用并行请求提高效率
      const datePromises = []
      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        datePromises.push(
          roomApi.getAllRooms(dateStr)
            .then(response => ({ dateStr, data: response?.data || [] }))
            .catch(err => {
              console.warn(`[RoomCalendar] 获取 ${dateStr} 房态失败:`, err.message)
              return { dateStr, data: [] }
            })
        )
      }

      const results = await Promise.all(datePromises)

      // 解析每天的房态数据
      const statusMap = {}
      for (const { dateStr, data } of results) {
        const roomData = data.find(r => String(r.room_number) === roomNumber)
        if (roomData && roomData.order_status) {
          // 该房间在该日有订单
          let status = roomData.order_status
          // 状态归一化
          if (status === '待入住' || status === 'pending' || status === 'reserved') status = 'pending'
          else if (status === '已入住' || status === 'checked-in' || status === 'occupied') status = 'checked-in'
          else if (status === '已退房' || status === 'checked-out') status = 'checked-out'

          statusMap[dateStr] = {
            status,
            guest_name: roomData.guest_name,
            order_id: roomData.order_id
          }
        }
        // 没有订单的日期不记录，getRoomDateStatus 会返回 'available'
      }

      dailyRoomStatus.value = statusMap
      console.log(`[RoomCalendar] 房间 ${roomNumber} 共 ${Object.keys(statusMap).length} 天有订单`)

      // 兼容旧的 roomBookingData 结构（用于 handleDateSelect）
      // 转换为简单数组供选中日期时查找
      roomBookingData.value = Object.entries(statusMap).map(([dateStr, info]) => ({
        stay_date: dateStr,
        status: info.status,
        guest_name: info.guest_name,
        order_id: info.order_id
      }))

    } catch (error) {
      console.error('[RoomCalendar] 获取日历数据失败', error)
    }
  }

  // --- 核心逻辑：判断某天的状态 ---
  // 改为直接查询 dailyRoomStatus，精确到每一天
  const getRoomDateStatus = (dateStr) => {
    const dayInfo = dailyRoomStatus.value[dateStr]
    if (!dayInfo) return 'available'

    if (dayInfo.status === 'checked-in') return 'occupied'
    if (dayInfo.status === 'pending') return 'reserved'
    if (dayInfo.status === 'checked-out') return 'available' // 已退房视为可用
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

    // 从 dailyRoomStatus 中查找该日期的详细信息
    const dayInfo = dailyRoomStatus.value[dateStr]

    selectedDateInfo.value = {
      date: dateStr,
      statusText: status === 'occupied' ? '已入住' : status === 'reserved' ? '已预订' : '可入住',
      color: status === 'occupied' ? 'red' : status === 'reserved' ? 'blue' : 'green',
      guestName: dayInfo?.guest_name
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
