/* 房态页状态控制：负责 URL 同步、单双视图查询和范围翻页。 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar, date as qDate } from 'quasar'
import { useRoomStore } from 'src/stores/roomStore'
import { useViewStore } from 'src/stores/viewStore'
import { useOrderStore } from 'src/stores/orderStore'

const CALENDAR_DAYS = 14
const VALID_VIEW_MODES = ['day', 'calendar']
const VALID_STATUS_VALUES = ['available', 'occupied', 'reserved', 'cleaning', 'repair']

// 中文注释：统一生成今日字符串，避免页面里散落相同默认值逻辑。
function getTodayDate() {
  return qDate.formatDate(Date.now(), 'YYYY-MM-DD')
}

// 中文注释：路由字符串统一裁剪，空值按 null 处理。
function normalizeQueryText(value) {
  if (Array.isArray(value)) value = value[0]
  if (value === undefined || value === null) return null
  const normalized = String(value).trim()
  return normalized || null
}

// 中文注释：日期参数只接受 YYYY-MM-DD，非法值直接回退到给定默认日期。
function normalizeQueryDate(value, fallback) {
  const normalized = normalizeQueryText(value)
  if (normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }
  return fallback
}

// 中文注释：日历翻页统一按 14 天窗口平移，避免不同组件重复计算。
function shiftDate(dateStr, amount) {
  const sourceDate = qDate.extractDate(dateStr, 'YYYY-MM-DD')
  return qDate.formatDate(qDate.addToDate(sourceDate, { days: amount }), 'YYYY-MM-DD')
}

// 中文注释：路由参数保持扁平结构，方便刷新和分享链接时直接还原视图。
function buildRoomStatusQuery(state) {
  return {
    view: state.viewMode,
    date: state.selectedDate,
    startDate: state.calendarStartDate,
    days: String(CALENDAR_DAYS),
    type: state.selectedRoomType || undefined,
    status: state.filterStatus || undefined,
    keyword: state.keyword || undefined
  }
}

export function useRoomFilters() {
  const $q = useQuasar()
  const route = useRoute()
  const router = useRouter()
  const roomStore = useRoomStore()
  const viewStore = useViewStore()
  const orderStore = useOrderStore()
  const syncingRoute = ref(false)

  const viewMode = ref('day')
  const selectedDate = ref(getTodayDate())
  const calendarStartDate = ref(getTodayDate())
  const selectedRoomType = ref(null)
  const filterStatus = ref(null)
  const keyword = ref('')

  const statusOptions = [
    { label: '全部状态', value: null },
    { label: '可入住', value: 'available' },
    { label: '已入住', value: 'occupied' },
    { label: '已预订', value: 'reserved' },
    { label: '清扫中', value: 'cleaning' },
    { label: '维修中', value: 'repair' }
  ]

  const roomTypeSelectOptions = computed(() => {
    const options = (roomStore.roomTypes || []).map(roomType => ({
      label: roomType.type_name || viewStore.getRoomTypeName(roomType.type_code),
      value: roomType.type_code
    }))
    return [{ label: '全部房型', value: null }, ...options]
  })

  const dayRooms = computed(() => roomStore.rooms || [])
  const calendarRooms = computed(() => roomStore.calendarBoard?.rooms || [])
  const calendarDailySummary = computed(() => roomStore.calendarBoard?.dailySummary || [])
  const activeSummary = computed(() => {
    return viewMode.value === 'day'
      ? roomStore.roomSummary
      : (roomStore.calendarBoard?.summary || roomStore.roomSummary)
  })

  // 中文注释：从路由恢复页面状态时，只做最小归一化，不额外触发查询。
  function applyRouteQuery(query = {}) {
    const today = getTodayDate()
    const nextViewMode = normalizeQueryText(query.view)
    const nextStatus = normalizeQueryText(query.status)

    viewMode.value = VALID_VIEW_MODES.includes(nextViewMode) ? nextViewMode : 'day'
    selectedDate.value = normalizeQueryDate(query.date, today)
    calendarStartDate.value = normalizeQueryDate(query.startDate, selectedDate.value)
    selectedRoomType.value = normalizeQueryText(query.type)
    filterStatus.value = VALID_STATUS_VALUES.includes(nextStatus) ? nextStatus : null
    keyword.value = normalizeQueryText(query.keyword) || ''
  }

  async function loadCurrentView(options = {}) {
    const notifyMessage = options?.notifyMessage ? String(options.notifyMessage).trim() : ''

    if (viewMode.value === 'calendar') {
      await roomStore.fetchCalendarBoard({
        startDate: calendarStartDate.value,
        days: CALENDAR_DAYS,
        typeCode: selectedRoomType.value,
        status: filterStatus.value,
        keyword: keyword.value
      })
    } else {
      await roomStore.fetchAllRooms({
        date: selectedDate.value,
        typeCode: selectedRoomType.value,
        status: filterStatus.value,
        keyword: keyword.value
      })
    }

    if (notifyMessage) {
      $q.notify({ type: 'positive', message: notifyMessage })
    }
  }

  async function syncRouteAndLoad(options = {}) {
    const nextQuery = buildRoomStatusQuery({
      viewMode: viewMode.value,
      selectedDate: selectedDate.value,
      calendarStartDate: calendarStartDate.value,
      selectedRoomType: selectedRoomType.value,
      filterStatus: filterStatus.value,
      keyword: keyword.value
    })

    syncingRoute.value = true
    await router.replace({ path: route.path, query: nextQuery })
    await loadCurrentView(options)
    syncingRoute.value = false
  }

  async function queryRoomStatus() {
    const successMessage = viewMode.value === 'calendar'
      ? `已显示 ${calendarStartDate.value} 起的 14 天日历`
      : `已显示 ${selectedDate.value} 房态`
    await syncRouteAndLoad({ notifyMessage: successMessage })
  }

  async function resetAllFilters() {
    const today = getTodayDate()
    viewMode.value = 'day'
    selectedDate.value = today
    calendarStartDate.value = today
    selectedRoomType.value = null
    filterStatus.value = null
    keyword.value = ''
    await syncRouteAndLoad({ notifyMessage: '已重置房态筛选' })
  }

  async function jumpToToday() {
    const today = getTodayDate()
    selectedDate.value = today
    calendarStartDate.value = today
    await syncRouteAndLoad()
  }

  async function switchView(mode) {
    const normalizedMode = VALID_VIEW_MODES.includes(mode) ? mode : 'day'
    viewMode.value = normalizedMode
    if (normalizedMode === 'calendar') {
      calendarStartDate.value = calendarStartDate.value || selectedDate.value || getTodayDate()
    }
    if (normalizedMode === 'day') {
      selectedDate.value = selectedDate.value || calendarStartDate.value || getTodayDate()
    }
    await syncRouteAndLoad()
  }

  async function goPrevRange() {
    if (viewMode.value === 'calendar') {
      calendarStartDate.value = shiftDate(calendarStartDate.value, -CALENDAR_DAYS)
    } else {
      selectedDate.value = shiftDate(selectedDate.value, -1)
    }
    await syncRouteAndLoad()
  }

  async function goNextRange() {
    if (viewMode.value === 'calendar') {
      calendarStartDate.value = shiftDate(calendarStartDate.value, CALENDAR_DAYS)
    } else {
      selectedDate.value = shiftDate(selectedDate.value, 1)
    }
    await syncRouteAndLoad()
  }

  async function openDayViewByDate(targetDate) {
    viewMode.value = 'day'
    selectedDate.value = normalizeQueryDate(targetDate, getTodayDate())
    await syncRouteAndLoad()
  }

  onMounted(async () => {
    // 中文注释：页面初始化只预加载房型和订单详情依赖，避免房态抽屉后续二次白屏。
    await roomStore.fetchRoomTypes()
    await orderStore.fetchAllOrders()
    applyRouteQuery(route.query)
    await syncRouteAndLoad()
  })

  watch(() => route.query, async (newQuery) => {
    // 中文注释：浏览器前进/后退场景需要从 URL 恢复状态并重新查询。
    if (syncingRoute.value) return
    applyRouteQuery(newQuery)
    await loadCurrentView()
  }, { deep: true })

  return {
    viewMode,
    selectedDate,
    calendarStartDate,
    selectedRoomType,
    filterStatus,
    keyword,
    statusOptions,
    roomTypeSelectOptions,
    dayRooms,
    calendarRooms,
    calendarDailySummary,
    activeSummary,
    loading: computed(() => roomStore.loading),
    refreshCurrentView: loadCurrentView,
    queryRoomStatus,
    resetAllFilters,
    jumpToToday,
    switchView,
    goPrevRange,
    goNextRange,
    openDayViewByDate
  }
}
