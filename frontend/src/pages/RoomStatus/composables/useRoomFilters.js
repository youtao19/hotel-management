/* 这个文件将接管主页面的核心逻辑：URL同步、筛选计算、重置功能、数据初始化。 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar, date as qDate } from 'quasar'
import { useRoomStore } from 'src/stores/roomStore'
import { useViewStore } from 'src/stores/viewStore'
import { useOrderStore } from 'src/stores/orderStore'

export function useRoomFilters() {
  const $q = useQuasar()
  const route = useRoute()
  const router = useRouter()

  // Store 实例
  const roomStore = useRoomStore()
  const viewStore = useViewStore()
  const orderStore = useOrderStore()

  // --- 状态 ---
  const selectedDate = ref(qDate.formatDate(Date.now(), 'YYYY-MM-DD')) // 默认今天（本地日期）
  const selectedRoomType = ref(null)
  const filterType = ref(null)
  const filterStatus = ref(null)

  // --- 静态配置 ---
  const statusOptions = [
    { label: '全部状态', value: null },
    { label: '可入住', value: 'available' },
    { label: '已入住', value: 'occupied' },
    { label: '已预订', value: 'reserved' },
    { label: '清扫中', value: 'cleaning' },
    { label: '维修中', value: 'repair' }
  ]

  // --- 计算属性 ---

  // 1. 房型选项逻辑 (包含可用数量统计)
  const roomTypeSelectOptions = computed(() => {
    const allOption = { label: '全部房型', value: null }
    const dbRoomTypes = roomStore.roomTypes || []

    // 如果数据库没数据，返回基础选项 (防止报错)
    if (!dbRoomTypes.length) return [allOption]

    const options = dbRoomTypes
      // 只显示有房间的房型
      .filter(rt => roomStore.rooms.some(r => r.type_code === rt.type_code))
      .map(rt => ({
        label: `${rt.type_name || viewStore.getRoomTypeName(rt.type_code)} (${roomStore.getAvailableRoomCountByType(rt.type_code)}/${roomStore.getTotalRoomCountByType(rt.type_code)})`,
        value: rt.type_code,
        description: rt.description || '',
        basePrice: rt.base_price || 0
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return [allOption, ...options]
  })

  // 2. 总可用房间数
  const totalAvailableRooms = computed(() => {
    return roomStore.rooms?.filter(r => roomStore.getRoomDisplayStatus(r) === 'available').length || 0
  })

  // 3. 核心筛选逻辑 (URL > 本地状态)
  const filteredRooms = computed(() => {
    if (!roomStore.rooms) return []

    // 归一化 URL 状态 (pending -> reserved)
    let urlStatus = route.query.status
    if (urlStatus === 'pending') urlStatus = 'reserved'

    const filters = {}

    // 房型逻辑：UI选择优先 > 内部状态 > URL参数
    if (selectedRoomType.value) filters.type = selectedRoomType.value
    else if (filterType.value) filters.type = filterType.value
    else if (route.query.type) filters.type = route.query.type

    // 状态逻辑
    if (filterStatus.value) filters.status = filterStatus.value
    else if (urlStatus) filters.status = urlStatus

    // 无筛选则返回全部
    if (!filters.type && !filters.status) return roomStore.rooms

    return roomStore.filterRooms(filters) || []
  })

  // --- 方法 ---

  // 加载指定日期数据
  const loadRoomDataForDate = async (date) => {
    try {
      if (!date) {
        // 清除日期，加载默认状态
        router.replace({ path: route.path, query: { ...route.query, queryDate: undefined } })
        await roomStore.fetchAllRooms()
        return
      }
      // 设置日期
      router.replace({ path: route.path, query: { ...route.query, queryDate: date } })
      await roomStore.fetchAllRooms(date)
    } catch (error) {
      console.error('加载数据失败', error)
      $q.notify({ type: 'negative', message: '加载数据失败' })
    }
  }

  // 点击“查询”按钮
  const queryRoomStatus = async () => {
    if (!selectedDate.value) {
      return $q.notify({ type: 'warning', message: '请先选择查询日期' })
    }
    roomStore.loading = true
    await loadRoomDataForDate(selectedDate.value)
    roomStore.loading = false
    $q.notify({ type: 'positive', message: `已显示 ${selectedDate.value} 状态` })
  }

  // 点击“重置”按钮
  const resetAllFilters = async () => {
    selectedRoomType.value = null
    filterType.value = null
    filterStatus.value = null
    selectedDate.value = null

    // 清空 URL
    router.replace({ path: route.path, query: {} })
    // 重新加载默认数据
    await roomStore.fetchAllRooms()
    $q.notify({ type: 'positive', message: '筛选已重置' })
  }

  // 日期改变事件
  const onDateChange = async (val) => {
    let date = val
    if (typeof date === 'string' && date.includes('/')) date = date.replace(/\//g, '-')
    selectedDate.value = date
    await loadRoomDataForDate(date)
  }

  // --- 监听与初始化 ---

  // 初始化：获取房型、订单、并根据URL加载数据
  onMounted(async () => {
    try {
      await roomStore.fetchRoomTypes()
      await orderStore.fetchAllOrders()

      const urlDate = route.query.queryDate
      if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
        selectedDate.value = urlDate
        await loadRoomDataForDate(urlDate)
      } else {
        await roomStore.fetchAllRooms()
      }
    } catch (error) {
      console.error('初始化失败:', error)
    }
  })

  // 监听 URL 变化 (支持浏览器后退/前进)
  watch(() => route.query, (newQuery) => {
    // 同步 Status
    if (newQuery.status !== filterStatus.value) {
      if (newQuery.status) {
        let sv = newQuery.status === 'pending' ? 'reserved' : newQuery.status
        if (['available', 'occupied', 'reserved', 'cleaning', 'repair'].includes(sv)) {
          filterStatus.value = sv
        }
      } else {
        filterStatus.value = null
      }
    }

    // 同步 Type
    if (newQuery.type !== filterType.value) {
      filterType.value = newQuery.type || null
    }

    // 同步 Date
    if (newQuery.queryDate && newQuery.queryDate !== selectedDate.value) {
      selectedDate.value = newQuery.queryDate
      loadRoomDataForDate(newQuery.queryDate)
    }
  }, { immediate: true, deep: true })

  // 监听内部状态变化，反向写入 URL
  watch(selectedRoomType, (val) => {
    filterType.value = val
    router.replace({ path: route.path, query: { ...route.query, type: val || undefined } })
  })

  watch(filterStatus, (val) => {
    let status = val === 'pending' ? 'reserved' : val
    router.replace({ path: route.path, query: { ...route.query, status: status || undefined } })
  })

  return {
    // State
    selectedDate,
    selectedRoomType,
    filterStatus,
    statusOptions,
    // Computed
    filteredRooms,
    roomTypeSelectOptions,
    totalAvailableRooms,
    loading: computed(() => roomStore.loading),
    // Methods
    queryRoomStatus,
    resetAllFilters,
    onDateChange,
    loadRoomDataForDate
  }
}
