import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { revenueApi, roomApi } from 'src/api'

/*
  useRevenueData.js
  用途：封装营收页面的数据拉取与处理逻辑。
  主要职责：
  - 初始化基础数据（房型列表、快速统计）
  - 拉取主报表数据（按日/周/月聚合）
  - 拉取房型维度的数据、汇总统计（overview）
  - 暴露状态（loading）与方法供页面调用
  说明：所有聚合与统计逻辑以后端为准，前端只负责显示与触发刷新。
*/

export function useRevenueData(dateRange, selectedPeriod) {
  const $q = useQuasar()
  const loading = ref(false)

  // 图表与表格数据
  const revenueData = ref([]) // 趋势数据（按日/周/月）
  const roomTypeData = ref([]) // 按房型聚合的营收数据
  const allRoomTypes = ref([]) // 所有房型（用于与统计数据做映射）
  const quickStats = ref({ today: {}, thisWeek: {}, thisMonth: {} }) // 快速统计：便于顶部显示
  const selectedRangeStats = ref({ total_revenue: 0, total_orders: 0 }) // 所选范围的汇总（后端直接返回）
  const selectedRoomType = ref(null) // 当前选中的房型过滤

  // 初始化基础数据：快速统计 + 房型列表
  const initBaseData = async () => {
    try {
      const [qRes, rtRes] = await Promise.all([
        // 快速统计以 dateRange.value.end 作为基准日期（后端约定）
        revenueApi.getQuickStats(dateRange.value?.end),
        roomApi.getRoomTypes()
      ])
      quickStats.value = qRes.data || quickStats.value
      allRoomTypes.value = rtRes.data || []
    } catch (e) { console.error(e) }
  }

  /*
    fetchMainStats：拉取当前筛选下的全部报表数据
    步骤：
    0. 更新快速统计（以 end 为基准）
    1. 根据 selectedPeriod 拉取趋势数据（daily/weekly/monthly）
    2. 拉取按房型的统计数据
    3. 拉取所选范围的汇总统计（后端返回已聚合结果）
    注意：所有接口返回的数据结构以后端为准，前端做弱防护（默认空数组/对象）
  */
  const fetchMainStats = async () => {
    if (!dateRange.value.start || !dateRange.value.end) return
    loading.value = true
    try {
      // 0. 快速统计
      const qRes = await revenueApi.getQuickStats(dateRange.value.end)
      quickStats.value = qRes.data || quickStats.value

      // 1. 趋势数据（按粒度）
      let res
      const args = [dateRange.value.start, dateRange.value.end, selectedRoomType.value]
      if (selectedPeriod.value === 'daily') res = await revenueApi.getDailyRevenue(...args)
      else if (selectedPeriod.value === 'weekly') res = await revenueApi.getWeeklyRevenue(...args)
      else res = await revenueApi.getMonthlyRevenue(...args)

      revenueData.value = res.data || []

      // 2. 房型维度数据
      const rtRes = await revenueApi.getRoomTypeRevenue(dateRange.value.start, dateRange.value.end)
      roomTypeData.value = rtRes.data || []

      // 3. 所选范围统计（后端返回 total_revenue / total_orders 等）
      const sRes = await revenueApi.getOverview(dateRange.value.start, dateRange.value.end)
      selectedRangeStats.value = sRes?.data || { total_revenue: 0, total_orders: 0 }

    } catch (e) {
      // 错误提示统一使用 Quasar Notify
      $q.notify({ type: 'negative', message: '获取数据失败' })
    } finally {
      loading.value = false
    }
  }

  // 切换房型过滤：再次刷新主数据
  const toggleRoomType = (type) => {
    selectedRoomType.value = selectedRoomType.value === type ? null : type
    fetchMainStats()
  }

  /*
    displayRoomTypeData：将后端返回的房型统计数据，与全量房型列表做映射，保证
    前端展示时每个房型都有对应的 name 和数值（不存在则填 0）
  */
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
