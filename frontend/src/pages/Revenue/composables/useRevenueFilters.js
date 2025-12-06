import { ref, computed } from 'vue'
import { date } from 'quasar'

export function useRevenueFilters() {
  const dateRange = ref({
    start: date.formatDate(date.subtractFromDate(new Date(), { days: 30 }), 'YYYY-MM-DD'),
    end: date.formatDate(new Date(), 'YYYY-MM-DD')
  })

  const selectedPeriod = ref('daily')
  const periodOptions = [
    { label: '每日统计', value: 'daily' },
    { label: '每周统计', value: 'weekly' },
    { label: '每月统计', value: 'monthly' }
  ]

  const setDateRange = (start, end) => {
    dateRange.value.start = start
    dateRange.value.end = end
  }

  const setFilterToday = () => {
    const today = date.formatDate(new Date(), 'YYYY-MM-DD')
    setDateRange(today, today)
  }

  const setFilterYesterday = () => {
    const yesterday = date.formatDate(date.subtractFromDate(new Date(), { days: 1 }), 'YYYY-MM-DD')
    setDateRange(yesterday, yesterday)
  }

  const setFilterThisWeek = () => {
    const today = new Date()
    const currentDay = today.getDay()
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay
    const monday = date.addToDate(today, { days: mondayOffset })
    const sunday = date.addToDate(monday, { days: 6 })
    setDateRange(date.formatDate(monday, 'YYYY-MM-DD'), date.formatDate(sunday, 'YYYY-MM-DD'))
  }

  const setFilterThisMonth = () => {
    const today = new Date()
    const first = date.startOfDate(today, 'month')
    const last = date.endOfDate(today, 'month')
    setDateRange(date.formatDate(first, 'YYYY-MM-DD'), date.formatDate(last, 'YYYY-MM-DD'))
  }

  const currentFilterType = computed(() => {
    const { start, end } = dateRange.value
    const today = new Date()
    const todayStr = date.formatDate(today, 'YYYY-MM-DD')

    if (!start || !end) return 'custom'
    if (start === todayStr && end === todayStr) return 'today'

    // Yesterday
    const yesterday = date.subtractFromDate(today, { days: 1 })
    const yesterdayStr = date.formatDate(yesterday, 'YYYY-MM-DD')
    if (start === yesterdayStr && end === yesterdayStr) return 'yesterday'

    // This Week
    const currentDay = today.getDay()
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay
    const monday = date.addToDate(today, { days: mondayOffset })
    const sunday = date.addToDate(monday, { days: 6 })
    if (start === date.formatDate(monday, 'YYYY-MM-DD') && end === date.formatDate(sunday, 'YYYY-MM-DD')) return 'week'

    // This Month
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
