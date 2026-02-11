import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { revenueApi } from 'src/api'

/*
  useDetailedBills.js
  用途：管理账单明细表格的数据获取与筛选逻辑。
  说明：
  - 提供 columns 列定义（用于 QTable 或类似组件）
  - 提供 fetchData 用于根据 filters 拉取数据（后端已按时间倒序排序）
  - resetFilters 重置筛选并重新拉取
*/

export function useDetailedBills() {
  const $q = useQuasar()
  const loading = ref(false)
  const rows = ref([])
  // filters.value 的结构：{ date: 'YYYY-MM-DD', roomNumber: '101' }
  // 业务要求：日期默认显示“今日”，但默认展示“全部账单”（首次加载不按日期过滤，需点“查询”才应用筛选）。
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const defaultDate = `${yyyy}-${mm}-${dd}`

  const filters = ref({
    date: defaultDate,
    roomNumber: '',
    orderId: '',
    guestName: '',
    payWay: '',
    changeType: ''
  })
  const hasSearched = ref(false)
  const pagination = ref({ rowsPerPage: 10 })

  // 支付方式筛选项（与后端账单 pay_way 枚举保持一致）
  const payWayOptions = ['现金', '微信', '微邮付', '平台', '其他']
  // 账单类型筛选项（覆盖常见变更类型）
  const changeTypeOptions = ['房费', '收押', '退押', '补收', '退款', '订单账单', '租车收入', '其他收入']
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
      const params = {}
      if (hasSearched.value) {
        // 查询触发后，才将筛选条件透传给后端。
        if (filters.value.date) params.date = filters.value.date
        if (filters.value.roomNumber) params.roomNumber = filters.value.roomNumber
        if (filters.value.orderId) params.orderId = filters.value.orderId
        if (filters.value.guestName) params.guestName = filters.value.guestName
        if (filters.value.payWay) params.payWay = filters.value.payWay
        if (filters.value.changeType) params.changeType = filters.value.changeType
      }

      const res = await revenueApi.getRevenueBills(params)
      const list = Array.isArray(res.data) ? res.data : []
      // 数据已由后端按时间倒序返回，前端不再二次排序。
      rows.value = list
    } catch (e) {
      // 请求失败时给出用户提示（优先展示后端返回的可读错误）。
      const message = e?.response?.data?.message || '获取账单明细失败'
      $q.notify({ type: 'negative', message })
    } finally {
      loading.value = false
    }
  }

  // 重置筛选并重新获取数据
  const resetFilters = () => {
    // 重置为初始态：仍然默认显示今日日期，但不自动应用筛选。
    filters.value = {
      date: defaultDate,
      roomNumber: '',
      orderId: '',
      guestName: '',
      payWay: '',
      changeType: ''
    }
    hasSearched.value = false
    fetchData()
  }

  return {
    rows,
    loading,
    filters,
    hasSearched,
    pagination,
    columns,
    payWayOptions,
    changeTypeOptions,
    fetchData,
    resetFilters
  }
}
