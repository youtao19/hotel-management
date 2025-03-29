import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useRoomStore = defineStore('room', () => {
  // 房间数据数组
  const rooms = ref([
    // 标准间
    { id: 1, number: '101', type: 'standard', status: 'available', price: 288 },
    { id: 2, number: '102', type: 'standard', status: 'occupied', currentGuest: '张三', checkOutDate: '2023-06-05', price: 288 },
    { id: 3, number: '103', type: 'standard', status: 'cleaning', price: 288 },
    { id: 4, number: '104', type: 'standard', status: 'reserved', price: 288 },
    { id: 5, number: '105', type: 'standard', status: 'maintenance', price: 288 },
    // 豪华间
    { id: 6, number: '201', type: 'deluxe', status: 'available', price: 388 },
    { id: 7, number: '202', type: 'deluxe', status: 'occupied', currentGuest: '李四', checkOutDate: '2023-06-07', price: 388 },
    { id: 8, number: '203', type: 'deluxe', status: 'available', price: 388 },
    { id: 9, number: '204', type: 'deluxe', status: 'reserved', price: 388 },
    // 套房
    { id: 10, number: '301', type: 'suite', status: 'available', price: 588 },
    { id: 11, number: '302', type: 'suite', status: 'occupied', currentGuest: '王五', checkOutDate: '2023-06-10', price: 588 },
    { id: 12, number: '303', type: 'suite', status: 'cleaning', price: 588 }
  ])

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
      suite: 0
    }
    
    rooms.value.forEach(room => {
      if (room.status === 'available' && counts[room.type] !== undefined) {
        counts[room.type]++
      }
    })
    
    return counts
  })

  /**
   * 根据条件筛选房间
   * @param {Object} filters - 筛选条件对象 {type, status}
   * @returns {Array} 筛选后的房间数组
   */
  function filterRooms(filters = {}) {
    return rooms.value.filter(room => {
      // 如果没有筛选条件，返回所有房间
      if (Object.keys(filters).length === 0) return true
      
      // 筛选房型
      if (filters.type && room.type !== filters.type) return false
      
      // 筛选状态
      if (filters.status && room.status !== filters.status) return false
      
      // 通过所有筛选条件，保留该房间
      return true
    })
  }

  /**
   * 获取指定ID的房间
   * @param {number} id - 房间ID
   * @returns {Object|null} 房间对象或null
   */
  function getRoomById(id) {
    return rooms.value.find(room => room.id === id) || null
  }

  /**
   * 获取指定房间号的房间
   * @param {string} number - 房间号
   * @returns {Object|null} 房间对象或null
   */
  function getRoomByNumber(number) {
    return rooms.value.find(room => room.number === number) || null
  }

  /**
   * 更新房间状态
   * @param {number} id - 房间ID
   * @param {string} status - 新状态
   * @returns {boolean} 更新是否成功
   */
  function updateRoomStatus(id, status) {
    const roomIndex = rooms.value.findIndex(room => room.id === id)
    if (roomIndex === -1) return false
    
    rooms.value[roomIndex].status = status
    return true
  }

  /**
   * 办理退房，将房间状态改为清扫中
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  function checkOutRoom(id) {
    return updateRoomStatus(id, 'cleaning')
  }

  /**
   * 设置房间为维修状态
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  function setMaintenance(id) {
    return updateRoomStatus(id, 'maintenance')
  }

  /**
   * 完成房间维修，将状态改为可用
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  function clearMaintenance(id) {
    return updateRoomStatus(id, 'available')
  }

  /**
   * 完成房间清洁，将状态改为可用
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  function clearCleaning(id) {
    return updateRoomStatus(id, 'available')
  }

  /**
   * 预订房间，将状态改为已预订
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  function reserveRoom(id) {
    return updateRoomStatus(id, 'reserved')
  }

  /**
   * 入住房间，将状态改为已入住
   * @param {number} id - 房间ID
   * @param {string} guestName - 客人姓名
   * @param {string} checkOutDate - 预计退房日期
   * @returns {boolean} 操作是否成功
   */
  function occupyRoom(id, guestName, checkOutDate) {
    const roomIndex = rooms.value.findIndex(room => room.id === id)
    if (roomIndex === -1) return false
    
    rooms.value[roomIndex].status = 'occupied'
    rooms.value[roomIndex].currentGuest = guestName
    rooms.value[roomIndex].checkOutDate = checkOutDate
    
    return true
  }

  return {
    rooms,
    totalRooms,
    countByStatus,
    availableByType,
    filterRooms,
    getRoomById,
    getRoomByNumber,
    updateRoomStatus,
    checkOutRoom,
    setMaintenance,
    clearMaintenance,
    clearCleaning,
    reserveRoom,
    occupyRoom
  }
}) 