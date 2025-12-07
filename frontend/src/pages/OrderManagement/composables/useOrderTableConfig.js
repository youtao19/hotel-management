// src/pages/OrderManagement/composables/useOrderTableConfig.js
import { useViewStore } from 'src/stores/viewStore'

export function useOrderTableConfig() {
  const viewStore = useViewStore()

  // --- 辅助工具 ---

  // 格式化日期 (去除时间部分)
  const formatDate = (val) => {
    if (!val) return ''
    return typeof val === 'string' && val.includes('T') ? val.split('T')[0] : val
  }

  // 判断是否为休息房 (入住日期 == 离店日期)
  const isRestRoom = (order) => {
    if (!order.checkInDate || !order.checkOutDate) return false
    const checkIn = new Date(order.checkInDate).toISOString().split('T')[0]
    const checkOut = new Date(order.checkOutDate).toISOString().split('T')[0]
    return checkIn === checkOut
  }

  // --- 表格列定义 ---
  const columns = [
    {
      name: 'orderNumber',
      align: 'left',
      label: '订单号',
      field: 'orderNumber',
      sortable: true
    },
    {
      name: 'guestName',
      align: 'left',
      label: '客人姓名',
      field: 'guestName',
      sortable: true
    },
    {
      name: 'phone',
      align: 'left',
      label: '手机号',
      field: 'phone'
    },
    {
      name: 'roomNumber',
      align: 'left',
      label: '房间号',
      field: 'roomNumber',
      sortable: true
    },
    {
      name: 'roomType',
      align: 'left',
      label: '房间类型',
      field: 'roomType',
      // 使用 store 中的转换方法
      format: val => viewStore.getRoomTypeName(val)
    },
    {
      name: 'checkInDate',
      align: 'left',
      label: '入住日期',
      field: 'checkInDate',
      sortable: true,
      format: formatDate
    },
    {
      name: 'checkOutDate',
      align: 'left',
      label: '离店日期',
      field: 'checkOutDate',
      sortable: true,
      format: formatDate
    },
    {
      name: 'orderType',
      align: 'center',
      label: '类型',
      field: 'orderType'
    },
    {
      name: 'status',
      align: 'left',
      label: '状态',
      field: 'status',
      sortable: true
    },
    {
      name: 'actions',
      align: 'center',
      label: '操作',
      field: 'actions'
    }
  ]

  return {
    columns,
    isRestRoom,
    formatDate,
    // 导出 store 实例供组件在 template 中直接使用 (例如获取状态颜色)
    viewStore
  }
}
