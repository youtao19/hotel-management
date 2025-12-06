import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import api from 'src/api' // 使用通用 axios 实例
import { useViewStore } from 'src/stores/viewStore'

export function useDailyReceipts() {
  const $q = useQuasar()
  const viewStore = useViewStore()

  const loading = ref(false)
  const rows = ref([])
  const searchKeyword = ref('') // 搜索房号

  // 表格列定义
  const columns = [
    { name: 'roomNumber', label: '房号', field: 'room_number', align: 'center', style: 'width: 80px' },
    { name: 'guestName', label: '客户姓名', field: 'guest_name', align: 'center' },
    { name: 'orderNumber', label: '单号', field: 'order_number', align: 'left' },
    { name: 'totalAmount', label: '实收金额', field: 'total_amount', align: 'right', sortable: true },
    {
      name: 'paymentMethod',
      label: '支付方式',
      field: r => viewStore.getPaymentMethodName(r.payment_method) || r.payment_method,
      align: 'center'
    },
    { name: 'date', label: '收款日期', field: 'stay_date_display', align: 'center', sortable: true }
  ]

  // 获取数据
  const fetchReceipts = async (startDate, endDate, roomType) => {
    if (!startDate || !endDate) return

    loading.value = true
    try {
      const res = await api.get('/revenue/daily-details', {
        params: {
          startDate,
          endDate,
          roomType: roomType || undefined
        }
      })

      if (res.success) {
        rows.value = res.data || []
      }
    } catch (error) {
      console.error(error)
      $q.notify({ type: 'negative', message: '获取营收明细失败' })
    } finally {
      loading.value = false
    }
  }

  // 前端过滤（按房号搜索）
  const filteredRows = computed(() => {
    if (!searchKeyword.value) return rows.value
    const k = searchKeyword.value.trim()
    return rows.value.filter(r => String(r.room_number).includes(k))
  })

  // 支付方式颜色辅助函数
  const getPayColor = (methodName) => {
    const m = String(methodName || '')
    if (m.includes('微信')) return 'green'
    if (m.includes('现金')) return 'orange'
    if (m.includes('支付宝')) return 'blue'
    return 'primary'
  }

  return {
    loading,
    rows,
    searchKeyword,
    columns,
    filteredRows,
    fetchReceipts,
    getPayColor
  }
}
