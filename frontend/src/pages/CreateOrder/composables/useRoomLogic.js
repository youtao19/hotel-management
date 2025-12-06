import { ref, computed, watch, nextTick } from 'vue'
import { date, useQuasar } from 'quasar'
import { useRoomStore } from 'src/stores/roomStore' // 假设路径
import { useViewStore } from 'src/stores/viewStore' // 假设路径

export function useRoomLogic(orderData, dateLogic) {
  const roomStore = useRoomStore()
  const viewStore = useViewStore()
  const $q = useQuasar()

  const availableRoomsByDate = ref([])
  const isDataInitialized = ref(false)
  let roomsUpdateTimer = null
  let suppressRoomTypeWatcher = false
  let shouldAutoSelectRoom = false
  let pendingRoomTypeChange = null

  // 核心：获取可用房间
  async function updateAvailableRooms(preserveSelection = true, allowAutoSelect = true) {
    try {
      if (!dateLogic.isValidFullDate(orderData.value.checkInDate) || !dateLogic.isValidFullDate(orderData.value.checkOutDate)) {
        return
      }
      const startDate = date.formatDate(orderData.value.checkInDate, 'YYYY-MM-DD')
      const endDate = date.formatDate(orderData.value.checkOutDate, 'YYYY-MM-DD')
      const previousRoomNumber = preserveSelection ? orderData.value.roomNumber : null

      const rooms = await roomStore.getAvailableRoomsByDate(startDate, endDate)
      availableRoomsByDate.value = rooms

      // 处理选择保持逻辑
      if (preserveSelection && previousRoomNumber) {
        const stillAvailable = rooms.some(room => String(room.room_number) === String(previousRoomNumber))
        if (!stillAvailable) {
          orderData.value.roomNumber = null
          shouldAutoSelectRoom = true
        }
      } else if (!preserveSelection) {
        orderData.value.roomNumber = null
        shouldAutoSelectRoom = true
      }

      // 检查特定房型库存
      if (pendingRoomTypeChange && pendingRoomTypeChange === orderData.value.roomType) {
         const countForType = rooms.filter(room => room.type_code === orderData.value.roomType).length
         if (countForType === 0) {
           $q.notify({ type: 'warning', message: '当前没有可用的该房型房间', position: 'top' })
         }
         pendingRoomTypeChange = null
      }

      await nextTick()
      if (allowAutoSelect && (shouldAutoSelectRoom || !orderData.value.roomNumber)) {
        const picked = autoSelectRandomRoom()
        if (picked) {
          shouldAutoSelectRoom = false
        }
      }

    } catch (error) {
      console.error('获取可用房间失败:', error)
      $q.notify({ type: 'negative', message: '获取可用房间失败', position: 'top' })
    }
  }

  function scheduleUpdateRooms() {
    if (roomsUpdateTimer) clearTimeout(roomsUpdateTimer)
    roomsUpdateTimer = setTimeout(() => updateAvailableRooms(), 250)
  }

  // 计算属性：房型选项（带数量）
  const roomTypeOptionsWithCount = computed(() => {
    if (roomStore.roomTypes && roomStore.roomTypes.length > 0) {
      return roomStore.roomTypes.map(roomType => {
        const availableCount = availableRoomsByDate.value.filter(r => r.type_code === roomType.type_code).length
        return {
          label: roomType.type_name,
          value: roomType.type_code,
          availableCount,
          basePrice: roomType.base_price || 0
        }
      })
    }
    return viewStore.roomTypeOptions.map(opt => ({
      ...opt,
      availableCount: availableRoomsByDate.value.filter(r => r.type_code === opt.value).length
    }))
  })

  // 计算属性：当前房型下的房间列表
  const availableRoomOptions = computed(() => {
    if (!orderData.value.roomType) return []
    return availableRoomsByDate.value
      .filter(room => room.type_code === orderData.value.roomType)
      .map(room => {
        const statusText = room.status === 'cleaning' ? ' [清扫中]' : room.status === 'repair' ? ' [维修中]' : ''
        return {
          label: `${room.room_number} (${viewStore.getRoomTypeName(room.type_code)})${statusText}`,
          value: room.room_number,
          type: room.type_code,
          price: room.price,
          status: room.status
        }
      })
  })

  const availableRoomCount = computed(() => {
    if (!orderData.value.roomType) return 0
    return availableRoomsByDate.value.filter(room => room.type_code === orderData.value.roomType).length
  })

  function findAvailableRoomByNumber(roomNumber) {
    if (!roomNumber && roomNumber !== 0) return null
    return availableRoomsByDate.value.find(room => String(room.room_number) === String(roomNumber)) || null
  }

  function autoSelectRandomRoom() {
    if (!orderData.value.roomType) return false
    if (!availableRoomOptions.value.length) return false
    const idx = Math.floor(Math.random() * availableRoomOptions.value.length)
    const target = availableRoomOptions.value[idx]
    orderData.value.roomNumber = target.value
    shouldAutoSelectRoom = false
    return true
  }

  function onRoomTypeChange(value) {
    orderData.value.roomNumber = null
    shouldAutoSelectRoom = true
    pendingRoomTypeChange = value
    const picked = autoSelectRandomRoom()
    if (!picked) {
      scheduleUpdateRooms()
    } else {
      pendingRoomTypeChange = null
    }
  }

  // 初始化
  async function init() {
    await roomStore.fetchRoomTypes()
    await roomStore.fetchAllRooms()
    await updateAvailableRooms()
    isDataInitialized.value = true
  }

  return {
    availableRoomsByDate,
    availableRoomOptions,
    roomTypeOptionsWithCount,
    availableRoomCount,
    updateAvailableRooms,
    scheduleUpdateRooms,
    autoSelectRandomRoom,
    findAvailableRoomByNumber,
    onRoomTypeChange,
    init,
    viewStore, // 暴露给模板使用
    roomStore
  }
}
