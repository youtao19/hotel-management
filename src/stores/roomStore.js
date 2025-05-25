import { defineStore } from 'pinia'
import { ref, computed, onMounted } from 'vue'
import { useViewStore } from './viewStore'
import { useOrderStore } from './orderStore'
import { roomApi } from '../api'
import { orderApi } from '../api'

// 在文件开头添加状态常量，使状态定义集中化
const ROOM_STATES = {
  AVAILABLE: 'available',    // 空闲
  OCCUPIED: 'occupied',      // 已入住
  RESERVED: 'reserved',      // 已预订
  CLEANING: 'cleaning',      // 清扫中
  REPAIR: 'repair'          // 维修中
};

const ORDER_STATES = {
  PENDING: 'pending',           // 待入住
  CHECKED_IN: 'checked-in',     // 已入住
  CHECKED_OUT: 'checked-out',   // 已退房
  CANCELLED: 'cancelled'        // 已取消
};

// 状态映射关系定义 - 订单状态到房间状态的映射
const ORDER_TO_ROOM_STATE_MAP = {
  [ORDER_STATES.CHECKED_IN]: ROOM_STATES.OCCUPIED,    // 已入住 -> 已入住
  [ORDER_STATES.PENDING]: ROOM_STATES.RESERVED,       // 待入住 -> 已预订
  [ORDER_STATES.CHECKED_OUT]: ROOM_STATES.CLEANING,   // 已退房 -> 清扫中
  [ORDER_STATES.CANCELLED]: ROOM_STATES.AVAILABLE     // 已取消 -> 空闲
};

// 定义状态颜色和文本映射
const STATUS_DISPLAY_CONFIG = {
  [ROOM_STATES.AVAILABLE]: { color: 'positive', text: '空闲', cssClass: 'bg-green-1' },
  [ROOM_STATES.OCCUPIED]: { color: 'negative', text: '已入住', cssClass: 'bg-red-1' },
  [ROOM_STATES.RESERVED]: { color: 'primary', text: '待入住', cssClass: 'bg-blue-1' },
  [ROOM_STATES.CLEANING]: { color: 'warning', text: '清扫中', cssClass: 'bg-orange-1' },
  [ROOM_STATES.REPAIR]: { color: 'grey-7', text: '维修中', cssClass: 'bg-grey-3' }
};

export const useRoomStore = defineStore('room', () => {
  // 导出状态常量，使其可以在组件中访问
  const STATES = ROOM_STATES;
  // 引入视图store以访问通用的状态文本和颜色
  const viewStore = useViewStore()
  const orderStore = useOrderStore()

  // 房间数据数组
  const rooms = ref([])
  // 房间类型
  const roomTypes = ref([])
  // 加载状态（用于反映前台的状态）
  const loading = ref(false)
  // 错误信息
  const error = ref(null)

  // 活跃订单(待入住和已入住)
  const activeOrders = ref([])

  // 获取所有订单数据并筛选活跃订单
  async function fetchActiveOrders() {
    try {
      loading.value = true

      // 使用orderStore的方法获取所有订单
      await orderStore.fetchAllOrders()
      const allOrders = orderStore.orders

      // 筛选活跃订单（待入住和已入住）
      activeOrders.value = allOrders.filter(order =>
        order.status === ORDER_STATES.PENDING ||
        order.status === ORDER_STATES.CHECKED_IN
      )

      return activeOrders.value
    } catch (err) {
      console.error('获取订单数据失败:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  // 获取所有房间数据并关联订单状态
  async function fetchAllRooms() {
    try {
      loading.value = true
      error.value = null

      // 先确保有最新的订单数据
      await fetchActiveOrders()

      // 获取所有房间数据
      const response = await roomApi.getAllRooms()

      if (!response || !response.data) {
        throw new Error('房间数据获取失败或格式错误')
      }

      // 创建房间号到订单的映射，优化查找效率
      const roomToOrderMap = {}
      activeOrders.value.forEach(order => {
        if (order.roomNumber) {
          roomToOrderMap[order.roomNumber] = order
        }
      })

      // 处理房间数据，设置显示状态
      rooms.value = response.data.map(room => {
        return processRoomData(room, roomToOrderMap)
      })

      // 统计显示状态
      const statusCounts = {}
      rooms.value.forEach(room => {
        const status = room.displayStatus
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })

      return rooms.value
    } catch (err) {
      console.error('获取房间数据失败:', err)
      error.value = '获取房间数据失败: ' + (err.message || String(err))
      return []
    } finally {
      loading.value = false
    }
  }

  // 处理单个房间数据，设置显示状态
  function processRoomData(room, roomToOrderMap = {}) {
    // 查找与该房间关联的订单
    const relatedOrder = roomToOrderMap[room.room_number]

    // 初始化默认值
    let displayStatus = room.status
    let orderStatus = room.order_status || null
    let guestName = room.guest_name || null
    let checkOutDate = room.check_out_date || null

    // 如果找到关联订单，更新房间信息
    if (relatedOrder) {
      orderStatus = relatedOrder.status
      guestName = relatedOrder.guestName
      checkOutDate = relatedOrder.checkOutDate

      // 根据订单状态确定房间显示状态
      const mappedStatus = ORDER_TO_ROOM_STATE_MAP[orderStatus]
      if (mappedStatus) {
        displayStatus = mappedStatus
      }
    } else {
      // 没有关联订单，根据房间自身状态处理
      if (room.status === ROOM_STATES.CLEANING || room.status === ROOM_STATES.REPAIR) {
        displayStatus = room.status
      } else {
        displayStatus = ROOM_STATES.AVAILABLE
      }
    }

    return {
      ...room,
      currentGuest: guestName,
      checkOutDate: checkOutDate,
      orderStatus: orderStatus,
      displayStatus: displayStatus
    }
  }

  // 获取所有房间类型
  async function fetchRoomTypes() {
    try {
      const response = await roomApi.getRoomTypes()
      roomTypes.value = response.data
      return roomTypes.value
    } catch (err) {
      console.error('获取房间类型失败:', err)
      return []
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
      repair: 0
    }

    rooms.value.forEach(room => {
      // 使用getRoomDisplayStatus获取综合状态
      const displayStatus = getRoomDisplayStatus(room)
      if (counts[displayStatus] !== undefined) {
        counts[displayStatus]++
      } else {
        counts['available']++
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

    // 使用getAvailableRoomCountByType方法计算每种类型的可用房间数
    Object.keys(counts).forEach(type => {
      counts[type] = getAvailableRoomCountByType(type)
    })

    return counts
  })

  /**
   * 前台的房间来源
   * 根据条件筛选房间
   * @param {Object} filters - 筛选条件对象 {type, status, dateRange}
   * @returns {Array} 筛选后的房间数组
   */
  function filterRooms(filters = {}) {
    if (Object.keys(filters).length === 0) {
      return rooms.value
    }

    return rooms.value.filter(room => {
      // 获取房间的显示状态
      const displayStatus = getRoomDisplayStatus(room)

      // 筛选房型
      if (filters.type && room.type_code !== filters.type) return false

      // 筛选状态 - 使用显示状态而不是原始状态
      if (filters.status && displayStatus !== filters.status) return false

      return true
    })
  }

  /**
   * 获取指定日期范围内的可用房间
   * @param {string} startDate - 入住日期 YYYY-MM-DD
   * @param {string} endDate - 退房日期 YYYY-MM-DD
   * @param {string} [typeCode] - 可选的房型代码
   * @returns {Promise<Array>} 可用房间列表
   */
  async function getAvailableRoomsByDate(startDate, endDate, typeCode = null) {
    try {
      console.log('查询可用房间:', { startDate, endDate, typeCode });

      // 构建查询参数
      const params = new URLSearchParams({
        startDate,
        endDate
      });

      if (typeCode) {
        params.append('typeCode', typeCode);
      }

      const response = await roomApi.getAvailableRooms(params.toString());
      const availableRoomsArray = response.data;

      if (!Array.isArray(availableRoomsArray)) {
        console.error('获取可用房间数据格式不正确，期望数组但得到:', availableRoomsArray);
        throw new Error('获取可用房间数据格式不正确');
      }

      console.log(`Store: 找到 ${availableRoomsArray.length} 个可用房间，将更新主房间列表`);
      // 直接用后端返回的、已按日期筛选的房间列表更新 store 中的 rooms
      rooms.value = availableRoomsArray.map(room => processRoomData(room, {})); // 确保返回的房间也经过 processRoomData 处理

      return rooms.value; // 返回更新后的 rooms.value
    } catch (error) {
      console.error('获取可用房间失败:', error);
      throw error;
    }
  }

  /**
   * 获取指定ID的房间
   * @param {number} id - 房间ID
   * @returns {Object|null} 房间对象或null
   */
  async function getRoomById(id) {
    try {
      const response = await roomApi.getRoomById(id)
      const roomData = response.data || null

      // 如果找到房间，处理显示状态
      if (roomData) {
        // 确保已获取活跃订单
        if (activeOrders.value.length === 0) {
          await fetchActiveOrders()
        }

        // 创建映射
        const roomToOrderMap = {}
        activeOrders.value.forEach(order => {
          if (order.roomNumber) {
            roomToOrderMap[order.roomNumber] = order
          }
        })

        return processRoomData(roomData, roomToOrderMap)
      }

      return null
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
  function getRoomByNumber(number) {
    // 首先尝试从本地缓存中查找
    const cachedRoom = rooms.value.find(r => r.room_number === number)
    if (cachedRoom) {
      return cachedRoom
    }

    // 本地未找到，再尝试通过API查询
    return roomApi.getRoomByNumber(number)
      .then(response => {
        const roomData = response.data || null

        // 如果找到房间，处理显示状态
        if (roomData) {
          // 创建映射
          const roomToOrderMap = {}
          activeOrders.value.forEach(order => {
            if (order.roomNumber) {
              roomToOrderMap[order.roomNumber] = order
            }
          })

          const processedRoom = processRoomData(roomData, roomToOrderMap)

          // 将查询结果加入本地缓存
          const existingIndex = rooms.value.findIndex(r => r.room_id === roomData.room_id)
          if (existingIndex >= 0) {
            rooms.value[existingIndex] = processedRoom
          } else {
            rooms.value.push(processedRoom)
          }

          return processedRoom
        }
        return null
      })
      .catch(err => {
        console.error(`获取房间号 ${number} 失败:`, err)
        return null
      })
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

        // 更新房间的显示状态
        updateRoomDisplayStatus(rooms.value[roomIndex])
      }

      return true
    } catch (err) {
      console.error(`更新房间状态失败:`, err)
      return false
    }
  }

  /**
   * 更新单个房间的显示状态
   * @param {Object} room - 房间对象
   */
  function updateRoomDisplayStatus(room) {
    // 获取关联的订单
    const relatedOrder = activeOrders.value.find(order => order.roomNumber === room.room_number)

    if (relatedOrder) {
      // 如果有关联订单，根据订单状态设置房间显示状态
      if (relatedOrder.status === ORDER_STATES.PENDING) {
        room.displayStatus = ROOM_STATES.RESERVED
      } else if (relatedOrder.status === ORDER_STATES.CHECKED_IN) {
        room.displayStatus = ROOM_STATES.OCCUPIED
      }
    } else {
      // 没有关联订单，使用房间自身状态
      if (room.status === ROOM_STATES.CLEANING || room.status === ROOM_STATES.REPAIR) {
        room.displayStatus = room.status
      } else {
        room.displayStatus = ROOM_STATES.AVAILABLE
      }
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
    return await updateRoomStatus(id, 'repair')
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
      await roomApi.updateRoomStatus(id, 'occupied', { guestName, checkOutDate })

      const roomIndex = rooms.value.findIndex(room => room.room_id === id)
      if (roomIndex !== -1) {
        rooms.value[roomIndex].status = 'occupied'
        rooms.value[roomIndex].currentGuest = guestName
        rooms.value[roomIndex].checkOutDate = checkOutDate
        rooms.value[roomIndex].displayStatus = ROOM_STATES.OCCUPIED

      } else {
        // 如果找不到房间，重新加载数据
        await fetchAllRooms()
      }

      return true
    } catch (err) {
      console.error('房间入住失败:', err)
      error.value = '办理入住失败，请稍后再试'
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
      const newRoom = processRoomData(response.data)
      rooms.value.push(newRoom)
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
    return rooms.value.filter(room => {
      // 获取房间的综合状态，考虑orderStatus和status
      const displayStatus = getRoomDisplayStatus(room)
      // 只统计状态为available的房间
      return room.type_code === type && displayStatus === ROOM_STATES.AVAILABLE
    }).length
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

  /**
   * 获取房间显示状态
   * @param {Object} room - 房间对象
   * @returns {string} 房间显示状态
   */
  function getRoomDisplayStatus(room) {

    // 如果有预计算的displayStatus，直接返回
    if (room.displayStatus) {
      return room.displayStatus;
    }

    // 订单状态优先
    if (room.orderStatus) {
      // 使用映射获取对应的房间状态
      const mappedStatus = ORDER_TO_ROOM_STATE_MAP[room.orderStatus];
      if (mappedStatus) {
        console.log(`房间${room.room_number}：订单状态${room.orderStatus}映射为${mappedStatus}`);
        return mappedStatus;
      }
    }

    // 如果是维修或清扫状态，保持原样
    if (room.status === ROOM_STATES.REPAIR || room.status === ROOM_STATES.CLEANING) {
      console.log(`房间${room.room_number}：保持原状态${room.status}`);
      return room.status;
    }

    // 其他任何状态均视为可用
    console.log(`房间${room.room_number}：设为可用状态`);
    return ROOM_STATES.AVAILABLE;
  }

  /**
   * 获取房间状态的CSS类
   * @param {Object} room - 房间对象
   * @returns {string} CSS类名
   */
  function getRoomStatusClass(room) {
    const status = getRoomDisplayStatus(room)
    return STATUS_DISPLAY_CONFIG[status]?.cssClass || 'bg-green-1'
  }

  /**
   * 获取房间状态的文本描述
   * @param {Object} room - 房间对象
   * @returns {string} 状态描述文本
   */
  function getRoomStatusText(room) {
    const status = getRoomDisplayStatus(room)
    return STATUS_DISPLAY_CONFIG[status]?.text || '未知'
  }

  /**
   * 获取房间状态的颜色
   * @param {Object} room - 房间对象
   * @returns {string} 状态颜色
   */
  function getRoomStatusColor(room) {
    const status = getRoomDisplayStatus(room)
    return STATUS_DISPLAY_CONFIG[status]?.color || 'grey'
  }

  /**
   * 同步所有房间的显示状态
   */
  function syncAllRoomStatus() {
    // 为所有房间更新显示状态
    rooms.value.forEach(room => {
      updateRoomDisplayStatus(room)
    })
    return Promise.resolve(true)
  }

  /**
   * 同步特定房间的状态
   * @param {number} roomId - 房间ID
   */
  function syncRoomStatus(roomId) {
    const room = rooms.value.find(r => r.room_id === roomId)
    if (room) {
      updateRoomDisplayStatus(room)
      return true
    }
    return false
  }

  /**
   * 刷新数据
   */
  async function refreshData() {
    try {
      await fetchActiveOrders()
      await fetchAllRooms()
      console.log('所有数据已刷新')
      return true
    } catch (err) {
      console.error('刷新数据失败:', err)
      return false
    }
  }

  // 监听订单变化
  function watchOrderChanges() {
    // 使用 orderStore.orders 来监听订单变化
    orderStore.$subscribe((mutation, state) => {
      console.log('订单状态发生变化，同步房间状态')
      syncAllRoomStatus()
    })
  }

  // 初始化函数
  function initialize() {
    console.log('初始化房间数据...')

    // 先获取订单，再加载房间数据
    fetchActiveOrders()
      .then(() => fetchAllRooms())
      .then(() => fetchRoomTypes())
      .then(() => {
        console.log('初始化完成')
        watchOrderChanges() // 设置订单变化监听
      })
      .catch(err => {
        console.error('初始化失败:', err)
      })
  }

  // 立即初始化
  initialize()



  return {
    // 状态常量 - 导出给组件使用
    ROOM_STATES,

    // 数据
    rooms,
    roomTypes,
    activeOrders,
    loading,
    error,

    // 计算属性
    totalRooms,
    countByStatus,
    availableByType,

    // 数据获取方法
    fetchAllRooms,
    fetchRoomTypes,
    fetchActiveOrders,

    // 房间操作方法
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

    // 房间状态方法
    getAvailableRoomOptions,
    getRoomTypeOptionsWithCount,
    getAvailableRoomCountByType,
    getRoomCountColor,
    getRoomDisplayStatus,
    getRoomStatusClass,
    getRoomStatusText,
    getRoomStatusColor,

    // 同步方法
    syncAllRoomStatus,
    syncRoomStatus,
    refreshData,
    getAvailableRoomsByDate
  }
})
