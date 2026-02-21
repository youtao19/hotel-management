/* 筛选逻辑 */
import { ref, computed } from 'vue'

export function useOrderFilters(allOrdersRef) {
  const searchQuery = ref('')
  const filterStatus = ref(null)
  const filterDate = ref(null)

  const statusOptions = [
    { label: '待入住', value: 'pending' },
    { label: '已入住', value: 'checked-in' },
    { label: '已退房', value: 'checked-out' },
    { label: '已取消', value: 'cancelled' }
  ]

  // 中文注释：日期输入统一裁剪到 YYYY-MM-DD，避免前端参与复杂日期解析。
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const normalized = String(dateStr).trim()
    if (!normalized) return ''
    return normalized.slice(0, 10)
  }

  // 中文注释：筛选条件由后端执行，这里仅组装查询参数。
  const queryFilters = computed(() => {
    const normalizedSearch = String(searchQuery.value || '').trim()
    const normalizedStatus = filterStatus.value ? String(filterStatus.value).trim() : ''
    const normalizedDate = formatDate(filterDate.value)
    return {
      search: normalizedSearch,
      status: normalizedStatus,
      date: normalizedDate
    }
  })

  // 中文注释：展示列表直接使用后端返回结果，不在前端二次过滤。
  const filteredOrders = computed(() => allOrdersRef.value || [])

  const clearFilters = () => {
    searchQuery.value = ''
    filterStatus.value = null
    filterDate.value = null
  }

  return {
    searchQuery,
    filterStatus,
    filterDate,
    statusOptions,
    queryFilters,
    filteredOrders,
    clearFilters,
    formatDate
  }
}
