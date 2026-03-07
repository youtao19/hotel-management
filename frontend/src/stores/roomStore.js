import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { roomApi } from '../api'

const ROOM_STATES = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  CLEANING: 'cleaning',
  REPAIR: 'repair'
}

const STATUS_DISPLAY_CONFIG = {
  [ROOM_STATES.AVAILABLE]: { color: 'positive', text: '空闲', cssClass: 'bg-green-1' },
  [ROOM_STATES.OCCUPIED]: { color: 'negative', text: '已入住', cssClass: 'bg-red-1' },
  [ROOM_STATES.RESERVED]: { color: 'primary', text: '待入住', cssClass: 'bg-blue-1' },
  [ROOM_STATES.CLEANING]: { color: 'warning', text: '清扫中', cssClass: 'bg-orange-1' },
  [ROOM_STATES.REPAIR]: { color: 'grey-7', text: '维修中', cssClass: 'bg-grey-3' }
}

function normalizeDisplayStatus(status) {
  if (!status) return ROOM_STATES.AVAILABLE
  const value = String(status).trim()
  if (Object.values(ROOM_STATES).includes(value)) return value
  return ROOM_STATES.AVAILABLE
}

// 中文注释：房态接口兼容旧的日期字符串调用和新的筛选对象调用。
function normalizeRoomQueryFilters(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input
  }
  return { date: input || null }
}

export const useRoomStore = defineStore('room', () => {
  const rooms = ref([])
  const roomTypes = ref([])
  const loading = ref(false)
  const error = ref(null)
  const roomSummary = ref({
    date: null,
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    cleaning: 0,
    repair: 0
  })
  const calendarBoard = ref({
    query: null,
    summary: null,
    dailySummary: [],
    rooms: []
  })

  async function fetchAllRooms(queryFilters = null) {
    try {
      loading.value = true
      error.value = null

      const response = await roomApi.getAllRooms(normalizeRoomQueryFilters(queryFilters))
      rooms.value = response?.data || []
      roomSummary.value = response?.summary || {
        date: null,
        total: 0,
        available: 0,
        occupied: 0,
        reserved: 0,
        cleaning: 0,
        repair: 0
      }
      return rooms.value
    } catch (err) {
      console.error('获取房间数据失败:', err)
      error.value = '获取房间数据失败: ' + (err?.message || String(err))
      rooms.value = []
      roomSummary.value = {
        date: null,
        total: 0,
        available: 0,
        occupied: 0,
        reserved: 0,
        cleaning: 0,
        repair: 0
      }
      return []
    } finally {
      loading.value = false
    }
  }

  async function fetchCalendarBoard(filters = {}) {
    try {
      loading.value = true
      error.value = null

      const response = await roomApi.getCalendarBoard(filters)
      calendarBoard.value = {
        query: response?.query || null,
        summary: response?.summary || null,
        dailySummary: response?.dailySummary || [],
        rooms: response?.rooms || []
      }
      return calendarBoard.value
    } catch (err) {
      console.error('获取日历房数据失败:', err)
      error.value = '获取日历房数据失败: ' + (err?.message || String(err))
      calendarBoard.value = {
        query: null,
        summary: null,
        dailySummary: [],
        rooms: []
      }
      return calendarBoard.value
    } finally {
      loading.value = false
    }
  }

  async function fetchRoomTypes() {
    try {
      const response = await roomApi.getRoomTypes()
      roomTypes.value = response?.data || []
      return roomTypes.value
    } catch (err) {
      console.error('获取房间类型失败:', err)
      roomTypes.value = []
      return []
    }
  }

  function getRoomDisplayStatus(room) {
    if (!room) return ROOM_STATES.AVAILABLE
    return normalizeDisplayStatus(room.display_status)
  }

  const totalRooms = computed(() => rooms.value.length)

  const countByStatus = computed(() => {
    const counts = {
      [ROOM_STATES.AVAILABLE]: 0,
      [ROOM_STATES.OCCUPIED]: 0,
      [ROOM_STATES.RESERVED]: 0,
      [ROOM_STATES.CLEANING]: 0,
      [ROOM_STATES.REPAIR]: 0
    }

    rooms.value.forEach(room => {
      const status = getRoomDisplayStatus(room)
      if (counts[status] !== undefined) counts[status] += 1
      else counts[ROOM_STATES.AVAILABLE] += 1
    })

    return counts
  })

  function filterRooms(filters = {}) {
    if (!filters || Object.keys(filters).length === 0) return rooms.value

    return rooms.value.filter(room => {
      const displayStatus = getRoomDisplayStatus(room)
      if (filters.type && room.type_code !== filters.type) return false
      if (filters.status && displayStatus !== filters.status) return false
      return true
    })
  }

  function getRoomByNumber(number) {
    return rooms.value.find(r => r.room_number === number) || null
  }

  async function updateRoomStatus(roomNumber, status) {
    try {
      const response = await roomApi.updateRoomStatus(roomNumber, status)
      const updated = response?.data

      const idx = rooms.value.findIndex(room => room.room_number === roomNumber)
      if (idx !== -1) {
        rooms.value[idx] = {
          ...rooms.value[idx],
          ...(updated || {}),
          display_status: normalizeDisplayStatus(status)
        }
      }
      return true
    } catch (err) {
      console.error('更新房间状态失败:', err)
      return false
    }
  }

  async function checkOutRoom(roomNumber) {
    return await updateRoomStatus(roomNumber, ROOM_STATES.CLEANING)
  }

  async function setMaintenance(roomNumber) {
    return await updateRoomStatus(roomNumber, ROOM_STATES.REPAIR)
  }

  async function clearMaintenance(roomNumber) {
    return await updateRoomStatus(roomNumber, ROOM_STATES.AVAILABLE)
  }

  async function clearCleaning(roomNumber) {
    return await updateRoomStatus(roomNumber, ROOM_STATES.AVAILABLE)
  }

  async function getAvailableRoomsByDate(startDate, endDate, typeCode = null) {
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (typeCode) params.append('typeCode', typeCode)

      const response = await roomApi.getAvailableRooms(params.toString())
      return response?.data || []
    } catch (error) {
      console.error('获取可用房间失败:', error)
      throw error
    }
  }

  function getAvailableRoomCountByType(type) {
    return rooms.value.filter(room => room.type_code === type && getRoomDisplayStatus(room) === ROOM_STATES.AVAILABLE).length
  }

  function getTotalRoomCountByType(type) {
    return rooms.value.filter(room => room.type_code === type).length
  }

  function getRoomCountColor(count) {
    if (count === 0) return 'negative'
    if (count === 1) return 'deep-orange'
    if (count <= 3) return 'warning'
    return 'positive'
  }

  function getRoomStatusClass(room) {
    const status = getRoomDisplayStatus(room)
    return STATUS_DISPLAY_CONFIG[status]?.cssClass || STATUS_DISPLAY_CONFIG[ROOM_STATES.AVAILABLE].cssClass
  }

  function getRoomStatusText(room) {
    const status = getRoomDisplayStatus(room)
    return STATUS_DISPLAY_CONFIG[status]?.text || STATUS_DISPLAY_CONFIG[ROOM_STATES.AVAILABLE].text
  }

  function getRoomStatusColor(room) {
    const status = getRoomDisplayStatus(room)
    return STATUS_DISPLAY_CONFIG[status]?.color || STATUS_DISPLAY_CONFIG[ROOM_STATES.AVAILABLE].color
  }

  async function refreshData() {
    try {
      await fetchAllRooms()
      return true
    } catch (err) {
      console.error('刷新房间数据失败:', err)
      return false
    }
  }

  return {
    ROOM_STATES,

    rooms,
    roomTypes,
    loading,
    error,
    roomSummary,
    calendarBoard,

    totalRooms,
    countByStatus,

    fetchAllRooms,
    fetchCalendarBoard,
    fetchRoomTypes,
    refreshData,

    filterRooms,
    getRoomByNumber,
    getRoomDisplayStatus,

    updateRoomStatus,
    checkOutRoom,
    setMaintenance,
    clearMaintenance,
    clearCleaning,

    getAvailableRoomsByDate,
    getAvailableRoomCountByType,
    getTotalRoomCountByType,
    getRoomCountColor,

    getRoomStatusClass,
    getRoomStatusText,
    getRoomStatusColor
  }
})
