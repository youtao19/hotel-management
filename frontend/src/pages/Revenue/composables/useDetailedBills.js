import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { revenueApi } from 'src/api'

/*
  useDetailedBills.js
  用途：管理账单明细表格的数据获取与筛选逻辑。
  说明：
  - 提供 columns 列定义（用于 QTable 或类似组件）
  - 提供 fetchData 用于根据 filters 拉取数据并按时间倒序排序
  - resetFilters 重置筛选并重新拉取
*/

export function useDetailedBills() {
  const $q = useQuasar()
  const loading = ref(false)
  const rows = ref([])
  // filters.value 的结构：{ date: 'YYYY-MM-DD', roomNumber: '101' }
  const filters = ref({ date: '', roomNumber: '' })
  const pagination = ref({ rowsPerPage: 10 })

  // 表格列定义（用于 QTable）
  const columns = [
    { name: 'bill_id', label: '账单ID', field: 'bill_id', align: 'left' },
    { name: 'order_id', label: '订单ID', field: 'order_id', align: 'left' },
    { name: 'room_number', label: '房间号', field: 'room_number', align: 'center' },
    { name: 'guest_name', label: '客人', field: 'guest_name', align: 'center' },
    { name: 'create_time', label: '时间', field: 'create_time', align: 'center' },
    { name: 'pay_way', label: '支付方式', field: 'pay_way', align: 'center' },
    { name: 'change_type', label: '类型', field: 'change_type', align: 'center' },
    { name: 'change_price', label: '金额', field: 'change_price', align: 'right' },
    { name: 'remarks', label: '备注', field: 'remarks', align: 'center' }
  ]

  // 根据当前 filters 拉取账单明细
  const fetchData = async () => {
    loading.value = true
    try {
      const res = await revenueApi.getRevenueBills(filters.value)
      const list = Array.isArray(res.data) ? res.data : []
      // 简单排序：按 create_time 倒序（最近的在前）
      rows.value = list.sort((a, b) => new Date(b.create_time) - new Date(a.create_time))
    } catch (e) {
      // 请求失败时给出用户提示
      $q.notify({ type: 'negative', message: '获取账单明细失败' })
    } finally {
      loading.value = false
    }
  }

  // 重置筛选并重新获取数据
  const resetFilters = () => {
    filters.value = { date: '', roomNumber: '' }
    fetchData()
  }

  return {
    rows,
    loading,
    filters,
    pagination,
    columns,
    fetchData,
    resetFilters
  }
}
