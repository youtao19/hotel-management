import { ref, computed } from 'vue'
import { date as qDate } from 'quasar'
import { roomApi } from 'src/api'

const STATUS_UI = {
  available: { color: 'green', text: '可入住' },
  reserved: { color: 'blue', text: '已预订' },
  occupied: { color: 'red', text: '已入住' },
  cleaning: { color: 'orange', text: '清扫中' },
  repair: { color: 'grey', text: '维修中' }
}

function toYmd(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function useRoomCalendar() {
  const currentRoom = ref(null)
  const roomBookingData = ref([])
  const dailyRoomStatus = ref({})

  const today = Date.now()
  const calendarDate = ref(qDate.formatDate(today, 'YYYY/MM/DD'))
  const selectedDateInfo = ref(null)
  const currentCalendarView = ref({
    year: Number(qDate.formatDate(today, 'YYYY')),
    month: Number(qDate.formatDate(today, 'M'))
  })

  const fetchMonthData = async (room, year, month) => {
    if (!room?.room_number) return
    currentRoom.value = room
    currentCalendarView.value = { year, month }

    const lastDay = new Date(year, month, 0).getDate()
    const startDate = toYmd(year, month, 1)
    const endDate = toYmd(year, month, lastDay)

    try {
      roomBookingData.value = []
      dailyRoomStatus.value = {}

      const response = await roomApi.getRoomStatusRange(room.room_number, startDate, endDate)
      const rows = response?.data || []

      roomBookingData.value = rows
      dailyRoomStatus.value = rows.reduce((acc, row) => {
        if (row?.stay_date) acc[row.stay_date] = row
        return acc
      }, {})
    } catch (error) {
      console.error('[RoomCalendar] 获取日历数据失败', error)
      roomBookingData.value = []
      dailyRoomStatus.value = {}
    }
  }

  const roomCalendarEvents = computed(() => {
    const { year, month } = currentCalendarView.value
    const daysInMonth = new Date(year, month, 0).getDate()
    const events = []
    for (let i = 1; i <= daysInMonth; i++) {
      events.push(`${year}/${String(month).padStart(2, '0')}/${String(i).padStart(2, '0')}`)
    }
    return events
  })

  const getEventColor = (timestamp) => {
    const dateStr = String(timestamp).replace(/\//g, '-')
    const status = dailyRoomStatus.value?.[dateStr]?.display_status || 'available'
    return STATUS_UI[status]?.color || STATUS_UI.available.color
  }

  const handleDateSelect = (date) => {
    if (!date) return
    const dateStr = String(date).replace(/\//g, '-')
    const row = dailyRoomStatus.value?.[dateStr]
    const status = row?.display_status || 'available'

    selectedDateInfo.value = {
      date: dateStr,
      statusText: STATUS_UI[status]?.text || STATUS_UI.available.text,
      color: STATUS_UI[status]?.color || STATUS_UI.available.color,
      guestName: row?.guest_name
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

