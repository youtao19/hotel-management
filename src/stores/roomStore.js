import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useViewStore } from './viewStore'

export const useRoomStore = defineStore('room', () => {
  // 引入视图store以访问通用的状态文本和颜色
  const viewStore = useViewStore()

  // 房间数据数组 - 整个应用的唯一数据源
  const rooms = ref([
    // 标准间
    { id: 1, number: '101', type: 'standard', status: 'available', price: 288 },
    { id: 2, number: '102', type: 'standard', status: 'occupied', currentGuest: '张三', checkOutDate: '2023-06-05', price: 288 },
    { id: 3, number: '103', type: 'standard', status: 'cleaning', price: 288 },
    { id: 4, number: '104', type: 'standard', status: 'reserved', price: 288 },
    { id: 5, number: '105', type: 'standard', status: 'maintenance', price: 288 },
    { id: 106, number: '106', type: 'standard', status: 'available', price: 288 },
    { id: 107, number: '107', type: 'standard', status: 'available', price: 288 },
    { id: 108, number: '108', type: 'standard', status: 'available', price: 288 },
    { id: 109, number: '109', type: 'standard', status: 'available', price: 288 },
    { id: 110, number: '110', type: 'standard', status: 'available', price: 288 },
    // 豪华间
    { id: 6, number: '201', type: 'deluxe', status: 'available', price: 388 },
    { id: 7, number: '202', type: 'deluxe', status: 'occupied', currentGuest: '李四', checkOutDate: '2023-06-07', price: 388 },
    { id: 8, number: '203', type: 'deluxe', status: 'available', price: 388 },
    { id: 9, number: '204', type: 'deluxe', status: 'reserved', price: 388 },
    { id: 205, number: '205', type: 'deluxe', status: 'available', price: 388 },
    { id: 206, number: '206', type: 'deluxe', status: 'available', price: 388 },
    { id: 207, number: '207', type: 'deluxe', status: 'available', price: 388 },
    { id: 208, number: '208', type: 'deluxe', status: 'available', price: 388 },
    // A 座高级豪华间
    { id: 210, number: 'A201', type: 'deluxe', status: 'available', price: 428 },
    { id: 211, number: 'A202', type: 'deluxe', status: 'available', price: 428 },
    { id: 212, number: 'A203', type: 'deluxe', status: 'available', price: 428 },
    // 套房
    { id: 10, number: '301', type: 'suite', status: 'available', price: 588 },
    { id: 11, number: '302', type: 'suite', status: 'occupied', currentGuest: '王五', checkOutDate: '2023-06-10', price: 588 },
    { id: 12, number: '303', type: 'suite', status: 'cleaning', price: 588 },
    { id: 304, number: '304', type: 'suite', status: 'available', price: 588 },
    { id: 305, number: '305', type: 'suite', status: 'available', price: 588 },
    { id: 306, number: '306', type: 'suite', status: 'available', price: 588 },
    // 总统套房
    { id: 401, number: '401', type: 'presidential', status: 'available', price: 1288 },
    { id: 402, number: '402', type: 'presidential', status: 'available', price: 1288 },
    { id: 403, number: '403', type: 'presidential', status: 'occupied', currentGuest: '赵六', checkOutDate: '2023-06-15', price: 1588 },
    // 家庭房
    { id: 501, number: '501', type: 'family', status: 'available', price: 688 },
    { id: 502, number: '502', type: 'family', status: 'occupied', currentGuest: '孙七', checkOutDate: '2023-06-12', price: 688 },
    { id: 503, number: '503', type: 'family', status: 'available', price: 688 },
    { id: 504, number: '504', type: 'family', status: 'reserved', price: 688 }
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
      suite: 0,
      presidential: 0,
      family: 0
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
   * @param {Object} filters - 筛选条件对象 {type, status, dateRange}
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
            if (room.status === 'occupied' && room.checkOutDate) {
              const checkOutDate = new Date(room.checkOutDate)
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
    console.log(`房间 ${rooms.value[roomIndex].number} 状态已更新为: ${status}`)
    return true
  }

  /**
   * 办理退房，将房间状态改为清扫中
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  function checkOutRoom(id) {
    const room = getRoomById(id)
    if (!room) return false
    
    console.log(`退房操作：房间 ${room.number} 从 ${room.status} 状态变为 cleaning`)
    return updateRoomStatus(id, 'cleaning')
  }

  /**
   * 设置房间为维修状态
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  function setMaintenance(id) {
    const room = getRoomById(id)
    if (!room) return false
    
    console.log(`维修操作：房间 ${room.number} 从 ${room.status} 状态变为 maintenance`)
    return updateRoomStatus(id, 'maintenance')
  }

  /**
   * 完成房间维修，将状态改为可用
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  function clearMaintenance(id) {
    const room = getRoomById(id)
    if (!room) return false
    
    console.log(`完成维修操作：房间 ${room.number} 从 maintenance 状态变为 available`)
    return updateRoomStatus(id, 'available')
  }

  /**
   * 完成房间清洁，将状态改为可用
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  function clearCleaning(id) {
    const room = getRoomById(id)
    if (!room) return false
    
    console.log(`完成清洁操作：房间 ${room.number} 从 cleaning 状态变为 available`)
    return updateRoomStatus(id, 'available')
  }

  /**
   * 预订房间，将状态改为已预订
   * @param {number} id - 房间ID
   * @returns {boolean} 操作是否成功
   */
  function reserveRoom(id) {
    const room = getRoomById(id)
    if (!room) return false
    
    console.log(`预订操作：房间 ${room.number} 从 ${room.status} 状态变为 reserved`)
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
    
    const oldStatus = rooms.value[roomIndex].status
    rooms.value[roomIndex].status = 'occupied'
    rooms.value[roomIndex].currentGuest = guestName
    rooms.value[roomIndex].checkOutDate = checkOutDate
    
    console.log(`入住操作：房间 ${rooms.value[roomIndex].number} 从 ${oldStatus} 状态变为 occupied，客人: ${guestName}，预计退房日期: ${checkOutDate}`)
    return true
  }

  /**
   * 添加新房间
   * @param {Object} room - 房间对象
   * @returns {boolean} 添加是否成功
   */
  function addRoom(room) {
    // 检查房间号是否已存在
    const exists = rooms.value.some(r => r.number === room.number)
    if (exists) return false
    
    // 添加新房间
    rooms.value.push(room)
    console.log(`添加新房间: ${room.number}，类型: ${room.type}，状态: ${room.status}，价格: ${room.price}`)
    return true
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
      label: `${room.number} (${viewStore.getRoomTypeName(room.type)})`,
      value: room.number,
      type: room.type,
      price: room.price,
      id: room.id
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
      room.type === type && room.status === 'available'
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
    occupyRoom,
    addRoom,
    getAvailableRoomOptions,
    getRoomTypeOptionsWithCount,
    getAvailableRoomCountByType,
    getRoomCountColor
  }
}) 