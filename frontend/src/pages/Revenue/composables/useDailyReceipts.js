import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import api from 'src/api' // 使用通用 axios 实例
import { useViewStore } from 'src/stores/viewStore'

/*
  useDailyReceipts.js
  用途：提供每日实收（收款）明细的数据拉取与前端展示逻辑。
  功能包括：
  - 定义表格列（columns）用于展示房号/客人/金额/支付方式等
  - fetchReceipts 根据时间范围向后端请求数据
  - 前端支持按房号快速搜索（filteredRows）
  - getPayColor 根据支付方式返回展示颜色（用于标签或徽章）
*/

export function useDailyReceipts() {
  const $q = useQuasar()
  const viewStore = useViewStore()

  const loading = ref(false)
  const rows = ref([])
  const searchKeyword = ref('') // 前端输入的房号搜索关键词

  // 表格列定义（字段名与后端返回对象字段保持一致或由 field 函数映射）
  const columns = [
    { name: 'roomNumber', label: '房号', field: 'room_number', align: 'center', style: 'width: 80px' },
    { name: 'guestName', label: '客户姓名', field: 'guest_name', align: 'center' },
    { name: 'orderNumber', label: '单号', field: 'order_number', align: 'left' },
    { name: 'totalAmount', label: '实收金额', field: 'total_amount', align: 'right', sortable: true },
    {
      name: 'paymentMethod',
      label: '支付方式',
      // 使用 viewStore 提供的映射方法将支付方式 code 转为展示文本
      field: r => viewStore.getPaymentMethodName(r.payment_method) || r.payment_method,
      align: 'center'
    },
    { name: 'date', label: '收款日期', field: 'stay_date_display', align: 'center', sortable: true }
  ]

  // 向后端请求指定时间段和房型的收款明细
  // 参数：startDate/endDate（YYYY-MM-DD），roomType 可选
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

      // 兼容后端返回格式：如果后端采用 { success: true, data: [...] } 风格，检查 success
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

  // 简单的前端过滤（按房号包含匹配）
  const filteredRows = computed(() => {
    if (!searchKeyword.value) return rows.value
    const k = searchKeyword.value.trim()
    return rows.value.filter(r => String(r.room_number).includes(k))
  })

  // 根据支付方式名称返回颜色（仅用于 UI 展示辅助）
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
