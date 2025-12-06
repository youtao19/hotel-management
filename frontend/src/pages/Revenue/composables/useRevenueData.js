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

  // 辅助：生成日期列表填充缺失数据
  const fillMissingDailyData = (rows, start, end) => {
    try {
      const map = new Map()
      rows.forEach(r => map.set(r.date.substring(0, 10), r))

      const list = []
      const s = new Date(start)
      const e = new Date(end)
      for (let d = s; d <= e; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        list.push(map.get(dateStr) || { date: dateStr, total_revenue: 0, order_count: 0 })
      }
      return list.sort((a, b) => a.date < b.date ? 1 : -1)
    } catch { return rows }
  }

  const initBaseData = async () => {
    try {
      const [qRes, rtRes] = await Promise.all([revenueApi.getQuickStats(), roomApi.getRoomTypes()])
      quickStats.value = qRes.data || quickStats.value
      allRoomTypes.value = rtRes.data || []
    } catch (e) { console.error(e) }
  }

  const fetchMainStats = async () => {
    if (!dateRange.value.start || !dateRange.value.end) return
    loading.value = true
    try {
      // 1. 趋势数据
      let res
      const args = [dateRange.value.start, dateRange.value.end, selectedRoomType.value]
      if (selectedPeriod.value === 'daily') res = await revenueApi.getDailyRevenue(...args)
      else if (selectedPeriod.value === 'weekly') res = await revenueApi.getWeeklyRevenue(...args)
      else res = await revenueApi.getMonthlyRevenue(...args)

      let raw = res.data || []
      if (selectedPeriod.value === 'daily') {
        raw = fillMissingDailyData(raw, dateRange.value.start, dateRange.value.end)
      }
      revenueData.value = raw

      // 2. 房型数据
      const rtRes = await revenueApi.getRoomTypeRevenue(dateRange.value.start, dateRange.value.end)
      roomTypeData.value = rtRes.data || []

      // 3. 选中范围单日统计
      const isSingle = dateRange.value.start === dateRange.value.end
      const targetDate = isSingle ? dateRange.value.start : new Date().toISOString().split('T')[0]
      const sRes = await revenueApi.getOverview(targetDate, targetDate)
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
