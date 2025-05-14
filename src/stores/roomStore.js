import { defineStore } from 'pinia'
import { ref, computed, onMounted } from 'vue'
import { useViewStore } from './viewStore'
import { roomApi } from '../api'

export const useRoomStore = defineStore('room', () => {
  // 引入视图store以访问通用的状态文本和颜色
  const viewStore = useViewStore()

  // 房间数据数组
  const rooms = ref([])
  // 房间类型
  const roomTypes = ref([])
  // 加载状态
  const loading = ref(false)
  // 错误信息
  const error = ref(null)

  // 获取所有房间数据
  async function fetchAllRooms() {
    try {
      loading.value = true
      error.value = null
      const response = await roomApi.getAllRooms()
      console.log('房间数据获取成功:', response)
      rooms.value = response.data
    } catch (err) {
      console.error('获取房间数据失败:', err)
      error.value = '获取房间数据失败'
    } finally {
      loading.value = false
    }
  }

  // 获取所有房间类型
  async function fetchRoomTypes() {
    try {
      const response = await roomApi.getRoomTypes()
      console.log('房间类型获取成功:', response)
      roomTypes.value = response.data
    } catch (err) {
      console.error('获取房间类型失败:', err)
    }
  }

  // 获取所有房间计数
  const totalRooms = computed(() => rooms.value.length)

  // 按状态获取房间数量
  const countByStatus = computed(() => {
    const counts = {
      available: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
      maintenance: 0
    }

    rooms.value.forEach(room => {
      if (counts[room.status] !== undefined) {
        counts[room.status]++
      }
    })

    return counts
  })

  // 按类型获取可用房间数量
  const availableByType = computed(() => {
    const counts = {
      standard: 0,
      deluxe: 0,
      suite: 0,
      presidential: 0,
      family: 0
    }

    rooms.value.forEach(room => {
      if (room.status === 'available' && counts[room.type_code] !== undefined) {
        counts[room.type_code]++
      }
    })

    return counts
  })

  /**
   * 根据条件筛选房间
   * @param {Object} filters - 筛选条件对象 {type, status, dateRange}
   * @returns {Array} 筛选后的房间数组
   */
  function filterRooms(filters = {}) {
    return rooms.value.filter(room => {
      // 如果没有筛选条件，返回所有房间
      if (Object.keys(filters).length === 0) return true

      // 筛选房型
      if (filters.type && room.type_code !== filters.type) return false

      // 筛选状态
      if (filters.status && room.status !== filters.status) return false

      // 筛选日期范围
      if (filters.dateRange) {
        // 日期格式应该是 "YYYY-MM-DD to YYYY-MM-DD"
        const [startDateStr, endDateStr] = filters.dateRange.split(' to ')
        if (startDateStr && endDateStr) {
          const startDate = new Date(startDateStr)
          const endDate = new Date(endDateStr)

          // 检查日期是否有效
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            // 已入住房间，检查退房日期是否在查询开始日期之前
            if (room.status === 'occupied' && room.check_out_date) {
              const checkOutDate = new Date(room.check_out_date)
              if (checkOutDate < startDate) {
                return false // 房间在查询日期前已空出
              }
            }

            // 已预订房间，应检查预订日期范围，但目前数据没有预订日期范围
            // 这里简化处理，将已预订的房间视为在选择的日期范围内不可用
            if (room.status === 'reserved') {
              return false
            }
          }
        }
      }

      // 通过所有筛选条件，保留该房间
      return true
    })
  }

  /**
   * 获取指定ID的房间
   * @param {number} id - 房间ID
   * @returns {Object|null} 房间对象或null
   */
  async function getRoomById(id) {
    try {
      const response = await roomApi.getRoomById(id)
      return response.data || null
    } catch (err) {
      console.error(`获取房间ID ${id} 失败:`, err)
      return null
    }
  }

  /**
   * 获取指定房间号的房间
   * @param {string} number - 房间号
   * @returns {Object|null} 房间对象或null
   */
  async function getRoomByNumber(number) {
    try {
      const response = await roomApi.getRoomByNumber(number)
      return response.data || null
    } catch (err) {
      console.error(`获取房间号 ${number} 失败:`, err)
      return null
    }
  }

  /**
   * 更新房间状态
   * @param {number} id - 房间ID
   * @param {string} status - 新状态
   * @returns {boolean} 更新是否成功
   */
  async function updateRoomStatus(id, status) {
    try {
      await roomApi.updateRoomStatus(id, status)
      // 更新本地状态
      const roomIndex = rooms.value.findIndex(room => room.room_id === id)
      if (roomIndex !== -1) {
        rooms.value[roomIndex].status = status
      }
      console.log(`房间 ID ${id} 状态已更新为: ${status}`)
      return true
    } catch (err) {
      console.error(`更新房间状态失败:`, err)
      return false
    }
  }

  /**
   * 办理退房，将房间状态改为清扫中
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  async function checkOutRoom(id) {
    return await updateRoomStatus(id, 'cleaning')
  }

  /**
   * 设置房间为维修状态
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  async function setMaintenance(id) {
    return await updateRoomStatus(id, 'maintenance')
  }

  /**
   * 完成房间维修，将状态改为可用
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  async function clearMaintenance(id) {
    return await updateRoomStatus(id, 'available')
  }

  /**
   * 完成房间清洁，将状态改为可用
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  async function clearCleaning(id) {
    return await updateRoomStatus(id, 'available')
  }

  /**
   * 预订房间，将状态改为已预订
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  async function reserveRoom(id) {
    return await updateRoomStatus(id, 'reserved')
  }

  /**
   * 入住房间，将状态改为已入住
   * @param {number} id - 房间ID
   * @param {string} guestName - 客人姓名
   * @param {string} checkOutDate - 预计退房日期
   * @returns {boolean} 操作是否成功
   */
  async function occupyRoom(id, guestName, checkOutDate) {
    try {
      await roomApi.updateRoomStatus(id, 'occupied')
      // 更新本地状态
      const roomIndex = rooms.value.findIndex(room => room.room_id === id)
      if (roomIndex !== -1) {
        rooms.value[roomIndex].status = 'occupied'
        rooms.value[roomIndex].current_guest = guestName
        rooms.value[roomIndex].check_out_date = checkOutDate
      }
      return true
    } catch (err) {
      console.error('房间入住失败:', err)
      return false
    }
  }

  /**
   * 添加新房间
   * @param {Object} room - 房间对象
   * @returns {boolean} 添加是否成功
   */
  async function addRoom(room) {
    try {
      const response = await roomApi.addRoom(room)
      // 添加到本地状态
      rooms.value.push(response.data)
      return true
    } catch (err) {
      console.error('添加房间失败:', err)
      return false
    }
  }

  /**
   * 获取指定房型的可用房间选项，适用于下拉框
   * @param {string} type - 房间类型
   * @returns {Array} 房间选项数组 [{label, value, type, price}]
   */
  function getAvailableRoomOptions(type = null) {
    const filtered = type
      ? filterRooms({ type, status: 'available' })
      : filterRooms({ status: 'available' })

    return filtered.map(room => ({
      label: `${room.room_number} (${viewStore.getRoomTypeName(room.type_code)})`,
      value: room.room_number,
      type: room.type_code,
      price: room.price,
      id: room.room_id
    }))
  }

  /**
   * 获取房间类型选项，附带可用房间数量，适用于下拉框
   * @returns {Array} 房间类型选项数组 [{label, value, availableCount}]
   */
  function getRoomTypeOptionsWithCount() {
    const typeOptions = viewStore.roomTypeOptions.filter(option => option.value !== null)

    return typeOptions.map(option => {
      const availableCount = filterRooms({
        type: option.value,
        status: 'available'
      }).length

      return {
        ...option,
        availableCount
      }
    })
  }

  /**
   * 获取特定房型的可用房间数量
   * @param {string} type - 房间类型
   * @returns {number} 该类型的可用房间数量
   */
  function getAvailableRoomCountByType(type) {
    return rooms.value.filter(room =>
      room.type_code === type && room.status === 'available'
    ).length
  }

  /**
   * 根据房间数量获取对应的颜色
   * @param {number} count - 房间数量
   * @returns {string} 对应的颜色
   */
  function getRoomCountColor(count) {
    if (count === 0) return 'negative'
    if (count === 1) return 'deep-orange'
    if (count <= 3) return 'warning'
    return 'positive'
  }

  // 初始加载数据
  function initialize() {
    console.log('开始初始化房间数据...')
    // 使用Promise.all同时加载房间数据和房间类型
    Promise.all([fetchAllRooms(), fetchRoomTypes()])
      .then(() => {
        console.log('房间数据初始化完成')
      })
      .catch(err => {
        console.error('房间数据初始化失败:', err)
      })
  }

  // 立即初始化，不等待组件挂载
  initialize()

  return {
    rooms,
    roomTypes,
    loading,
    error,
    totalRooms,
    countByStatus,
    availableByType,
    fetchAllRooms,
    fetchRoomTypes,
    filterRooms,
    getRoomById,
    getRoomByNumber,
    updateRoomStatus,
    checkOutRoom,
    setMaintenance,
    clearMaintenance,
    clearCleaning,
    reserveRoom,
    occupyRoom,
    addRoom,
    getAvailableRoomOptions,
    getRoomTypeOptionsWithCount,
    getAvailableRoomCountByType,
    getRoomCountColor
  }
})
