import { ref, computed } from 'vue'
import { date } from 'quasar'

/*
  useRevenueFilters.js
  用途：为营收页面提供日期范围选择与快捷筛选（今日/昨日/本周/本月）逻辑。
  说明：
  - 该 Composable 返回一个可响应的 dateRange（{ start, end }）用于请求后端数据。
  - 提供一组常用快捷操作（setFilterToday / Yesterday / ThisWeek / ThisMonth），
    方便 UI 绑定按钮或下拉菜单使用。
  - 使用 Quasar 的 `date` 工具进行日期计算与格式化，保证前端显示的日期格式为 YYYY-MM-DD。
*/

export function useRevenueFilters() {
  // 当前选中的日期范围（start/end 均为 YYYY-MM-DD 字符串）
  const dateRange = ref({
    // 默认：最近 30 天（end = 今天）
    start: date.formatDate(date.subtractFromDate(new Date(), { days: 30 }), 'YYYY-MM-DD'),
    end: date.formatDate(new Date(), 'YYYY-MM-DD')
  })

  // 报表周期（用于图表聚合粒度）：daily / weekly / monthly
  const selectedPeriod = ref('daily')
  const periodOptions = [
    { label: '每日统计', value: 'daily' },
    { label: '每周统计', value: 'weekly' },
    { label: '每月统计', value: 'monthly' }
  ]

  // 设置日期范围的通用方法，接收 YYYY-MM-DD 字符串
  const setDateRange = (start, end) => {
    dateRange.value.start = start
    dateRange.value.end = end
  }

  // 快捷筛选：今天
  const setFilterToday = () => {
    const today = date.formatDate(new Date(), 'YYYY-MM-DD')
    setDateRange(today, today)
  }

  // 快捷筛选：昨天
  const setFilterYesterday = () => {
    const yesterday = date.formatDate(date.subtractFromDate(new Date(), { days: 1 }), 'YYYY-MM-DD')
    setDateRange(yesterday, yesterday)
  }

  // 快捷筛选：本周（周一到周日）
  // 注意：getDay() 返回 0-6，0 为周日；这里把周一作为周开始
  const setFilterThisWeek = () => {
    const today = new Date()
    const currentDay = today.getDay()
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay
    const monday = date.addToDate(today, { days: mondayOffset })
    const sunday = date.addToDate(monday, { days: 6 })
    setDateRange(date.formatDate(monday, 'YYYY-MM-DD'), date.formatDate(sunday, 'YYYY-MM-DD'))
  }

  // 快捷筛选：本月（当月第一天到最后一天）
  const setFilterThisMonth = () => {
    const today = new Date()
    const first = date.startOfDate(today, 'month')
    const last = date.endOfDate(today, 'month')
    setDateRange(date.formatDate(first, 'YYYY-MM-DD'), date.formatDate(last, 'YYYY-MM-DD'))
  }

  /*
    currentFilterType：根据当前 dateRange 判断属于哪个快捷类型（today/yesterday/week/month/custom）
    目的：用于 UI 高亮当前所选的快捷筛选项
  */
  const currentFilterType = computed(() => {
    const { start, end } = dateRange.value
    const today = new Date()
    const todayStr = date.formatDate(today, 'YYYY-MM-DD')

    if (!start || !end) return 'custom'
    if (start === todayStr && end === todayStr) return 'today'

    // 昨天判断
    const yesterday = date.subtractFromDate(today, { days: 1 })
    const yesterdayStr = date.formatDate(yesterday, 'YYYY-MM-DD')
    if (start === yesterdayStr && end === yesterdayStr) return 'yesterday'

    // 本周判断（周一到周日）
    const currentDay = today.getDay()
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay
    const monday = date.addToDate(today, { days: mondayOffset })
    const sunday = date.addToDate(monday, { days: 6 })
    if (start === date.formatDate(monday, 'YYYY-MM-DD') && end === date.formatDate(sunday, 'YYYY-MM-DD')) return 'week'

    // 本月判断
    const first = date.startOfDate(today, 'month')
    const last = date.endOfDate(today, 'month')
    if (start === date.formatDate(first, 'YYYY-MM-DD') && end === date.formatDate(last, 'YYYY-MM-DD')) return 'month'

    return 'custom'
  })

  return {
    dateRange,
    selectedPeriod,
    periodOptions,
    currentFilterType,
    setFilterToday,
    setFilterYesterday,
    setFilterThisWeek,
    setFilterThisMonth
  }
}
