import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { revenueApi, roomApi } from 'src/api'

export function useRevenueData(dateRange, selectedPeriod) {
  const $q = useQuasar()
  const loading = ref(false)

  const revenueData = ref([])
  const roomTypeData = ref([])
  const allRoomTypes = ref([])
  const quickStats = ref({ today: {}, thisWeek: {}, thisMonth: {} })
  const selectedRangeStats = ref({ total_revenue: 0, total_orders: 0 })
  const selectedRoomType = ref(null)

  const initBaseData = async () => {
    try {
      const [qRes, rtRes] = await Promise.all([
        // 中文注释：快速统计基于后端口径计算，前端仅传 baseDate（默认取所选范围 end）用于对账/测试
        revenueApi.getQuickStats(dateRange.value?.end),
        roomApi.getRoomTypes()
      ])
      quickStats.value = qRes.data || quickStats.value
      allRoomTypes.value = rtRes.data || []
    } catch (e) { console.error(e) }
  }

  const fetchMainStats = async () => {
    if (!dateRange.value.start || !dateRange.value.end) return
    loading.value = true
    try {
      // 0. 快速统计（本周/本月）以所选 end 作为基准日，便于使用交接班测试 SQL 数据进行对账
      const qRes = await revenueApi.getQuickStats(dateRange.value.end)
      quickStats.value = qRes.data || quickStats.value

      // 1. 趋势数据
      let res
      const args = [dateRange.value.start, dateRange.value.end, selectedRoomType.value]
      if (selectedPeriod.value === 'daily') res = await revenueApi.getDailyRevenue(...args)
      else if (selectedPeriod.value === 'weekly') res = await revenueApi.getWeeklyRevenue(...args)
      else res = await revenueApi.getMonthlyRevenue(...args)

      revenueData.value = res.data || []

      // 2. 房型数据
      const rtRes = await revenueApi.getRoomTypeRevenue(dateRange.value.start, dateRange.value.end)
      roomTypeData.value = rtRes.data || []

      // 3. 所选范围统计：逻辑直接来自后端 API，前端不做二次计算
      const sRes = await revenueApi.getOverview(dateRange.value.start, dateRange.value.end)
      selectedRangeStats.value = sRes?.data || { total_revenue: 0, total_orders: 0 }

    } catch (e) {
      $q.notify({ type: 'negative', message: '获取数据失败' })
    } finally {
      loading.value = false
    }
  }

  const toggleRoomType = (type) => {
    selectedRoomType.value = selectedRoomType.value === type ? null : type
    fetchMainStats()
  }

  const displayRoomTypeData = computed(() => {
    if (!allRoomTypes.value.length) return roomTypeData.value
    const map = new Map(roomTypeData.value.map(i => [i.room_type || i.type_code, i]))
    return allRoomTypes.value.map(rt => {
      const data = map.get(rt.type_code) || {}
      return {
        room_type: rt.type_code,
        type_name: rt.type_name,
        total_revenue: Number(data.total_revenue || 0),
        order_count: Number(data.order_count || 0),
        avg_revenue_per_order: Number(data.avg_revenue_per_order || 0)
      }
    })
  })

  return {
    loading,
    revenueData,
    quickStats,
    selectedRangeStats,
    selectedRoomType,
    displayRoomTypeData,
    initBaseData,
    fetchMainStats,
    toggleRoomType,
    clearSelectedRoomType: () => toggleRoomType(selectedRoomType.value)
  }
}
