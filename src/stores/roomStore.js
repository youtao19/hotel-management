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
      rooms.value = response.data.map(room => {
        // 处理房间状态与订单状态的关联
        let displayStatus = room.status;
        let orderStatus = room.order_status; // 假设API返回了关联的订单状态

        // 设置房间显示状态的优先级：订单状态 > 房间状态
        if (orderStatus) {
          // 订单状态优先
          if (orderStatus === '已入住') {
            displayStatus = 'occupied'; // 已入住
          } else if (orderStatus === '待入住') {
            displayStatus = 'reserved'; // 待入住
          } else if (orderStatus === '已退房') {
            displayStatus = 'cleaning'; // 退房后自动设为清扫中
          } else if (orderStatus === '已取消') {
            displayStatus = 'available'; // 订单取消则恢复为空闲
          }
        } else {
          // 如果没有订单状态，根据房间状态设置
          if (room.status === 'cleaning') {
            displayStatus = 'cleaning'; // 清扫中
          } else if (room.status === 'repair') {
            displayStatus = 'repair'; // 维修中
          } else if (room.status === 'supply') {
            displayStatus = 'available'; // 可供应视为空闲
          }
        }

        return {
          ...room,
          currentGuest: room.guest_name,
          checkOutDate: room.check_out_date,
          orderStatus: orderStatus,
          displayStatus: displayStatus // 新增一个显示状态字段
        };
      });

      console.log('房间状态处理后数据:', rooms.value.map(room => ({
        id: room.room_id,
        number: room.room_number,
        status: room.status,
        orderStatus: room.orderStatus,
        displayStatus: room.displayStatus
      })));
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
      repair: 0
    }

    rooms.value.forEach(room => {
      // 使用getRoomDisplayStatus获取综合状态
      const displayStatus = getRoomDisplayStatus(room);

      if (displayStatus === 'supply') {
        // 将supply状态归为available
        counts['available']++;
      } else if (counts[displayStatus] !== undefined) {
        counts[displayStatus]++;
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
      counts[type] = getAvailableRoomCountByType(type);
    });

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
      // 确保将客人姓名和退房日期传递给后端API进行保存
      // 假设 roomApi.updateRoomStatus 或其他相关接口支持接收这些额外参数
      // 您可能需要根据您的后端API实际情况调整这里的调用方式
      await roomApi.updateRoomStatus(id, 'occupied', { guestName, checkOutDate }); // 示例：传递额外数据
      // 根据房间 ID 找到本地房间索引
      const roomIndex = rooms.value.findIndex(room => room.room_id === id);

      if (roomIndex !== -1) {
        rooms.value[roomIndex].status = 'occupied';
        // 直接使用传入的参数更新本地状态，确保信息被设置
        rooms.value[roomIndex].current_guest = guestName;
        rooms.value[roomIndex].check_out_date = checkOutDate;
        console.log(`房间 ID ${id} 入住成功，本地状态已更新。客人: ${guestName}, 退房日期: ${checkOutDate}`);
      } else {
        // 如果本地没找到房间，可能需要重新加载所有房间数据
        console.warn(`本地未找到房间 ID ${id}，尝试重新加载所有房间数据。`);
        await fetchAllRooms(); // 重新加载所有房间以确保数据一致性
      }
      return true;
    } catch (err) {
      console.error('房间入住失败:', err);
      error.value = '办理入住失败，请稍后再试。';
      return false;
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
    return rooms.value.filter(room => {
      // 获取房间的综合状态，考虑orderStatus和status
      const displayStatus = getRoomDisplayStatus(room);
      // 统计状态为available或supply的房间
      return room.type_code === type && (displayStatus === 'available' || displayStatus === 'supply');
    }).length;
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
    // 如果有displayStatus字段，直接返回
    if (room.displayStatus) {
      return room.displayStatus;
    }

    // 否则根据orderStatus和status计算
    if (room.orderStatus === '已入住') {
      return 'occupied';
    } else if (room.orderStatus === '待入住') {
      return 'reserved';
    } else if (room.orderStatus === '已退房') {
      return 'cleaning';
    } else if (room.orderStatus === '已取消') {
      return 'available';
    }

    // 如果没有订单状态，返回房间状态
    return room.status;
  }

  /**
   * 获取房间状态的CSS类
   * @param {Object} room - 房间对象
   * @returns {string} CSS类名
   */
  function getRoomStatusClass(room) {
    const status = getRoomDisplayStatus(room);

    switch (status) {
      case 'occupied': return 'bg-red-1'; // 已入住 - 红色
      case 'reserved': return 'bg-blue-1'; // 待入住 - 蓝色
      case 'cleaning': return 'bg-orange-1'; // 清扫中 - 橙色
      case 'repair': return 'bg-grey-3'; // 维修中 - 灰色
      case 'available':
      case 'supply': return 'bg-green-1'; // 空闲/可供应 - 绿色
      default: return 'bg-green-1'; // 默认绿色
    }
  }

  /**
   * 获取房间状态的文本描述
   * @param {Object} room - 房间对象
   * @returns {string} 状态描述文本
   */
  function getRoomStatusText(room) {
    const status = getRoomDisplayStatus(room);

    switch (status) {
      case 'occupied': return '已入住';
      case 'reserved': return '待入住';
      case 'cleaning': return '清扫中';
      case 'repair': return '维修中';
      case 'available': return '空闲';
      case 'supply': return '可供应';
      default: return status;
    }
  }

  /**
   * 获取房间状态的颜色
   * @param {Object} room - 房间对象
   * @returns {string} 状态颜色
   */
  function getRoomStatusColor(room) {
    const status = getRoomDisplayStatus(room);

    switch (status) {
      case 'occupied': return 'red';
      case 'reserved': return 'blue';
      case 'cleaning': return 'orange';
      case 'repair': return 'grey';
      case 'available':
      case 'supply': return 'green';
      default: return 'grey';
    }
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
    getRoomCountColor,
    getRoomDisplayStatus,
    getRoomStatusClass,
    getRoomStatusText,
    getRoomStatusColor
  }
})
