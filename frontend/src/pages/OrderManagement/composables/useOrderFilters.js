/* 筛选逻辑 */
import { ref, computed } from 'vue'
import { date } from 'quasar'

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

  // 辅助格式化
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    if (typeof dateStr === 'string' && dateStr.includes('T')) return dateStr.split('T')[0]
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? dateStr : date.formatDate(d, 'YYYY-MM-DD')
  }

  const filteredOrders = computed(() => {
    let result = allOrdersRef.value || []

    // 搜索
    if (searchQuery.value) {
      const query = String(searchQuery.value).toLowerCase()
      result = result.filter(order => {
        const orderNo = order.orderNumber ? String(order.orderNumber).toLowerCase() : ''
        const guest = order.guestName ? String(order.guestName).toLowerCase() : ''
        const phone = order.phone ? String(order.phone) : ''
        const room = order.roomNumber ? String(order.roomNumber).toLowerCase() : ''
        return orderNo.includes(query) || guest.includes(query) || phone.includes(query) || room.includes(query)
      })
    }

    // 状态筛选
    if (filterStatus.value) {
      result = result.filter(order => order.status === filterStatus.value)
    }

    // 日期筛选
    if (filterDate.value) {
      const targetDate = formatDate(filterDate.value)
      result = result.filter(order => {
        const checkIn = order.checkInDate ? formatDate(order.checkInDate) : ''
        const checkOut = order.checkOutDate ? formatDate(order.checkOutDate) : ''
        return checkIn === targetDate || checkOut === targetDate
      })
    }

    return result
  })

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
    filteredOrders,
    clearFilters,
    formatDate
  }
}
