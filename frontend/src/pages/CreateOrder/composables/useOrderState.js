import { ref } from 'vue'
import { date } from 'quasar'
import { useViewStore } from 'src/stores/viewStore' // 假设路径，请根据实际调整

export function useOrderState() {
  const viewStore = useViewStore()

  // 生成订单号
  function generateOrderNumber() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `O${year}${month}${day}${random}`
  }

  // 静态选项配置
  const statusOptions = [
    { label: '所有状态', value: 'all' },
    { label: '待入住', value: 'pending' },
    { label: '已入住', value: 'checked-in' }
  ]

  const sourceOptions = [
    { label: '前台录入', value: 'front_desk' },
    { label: '电话预订', value: 'phone' },
    { label: '抖音', value: 'douyin' },
    { label: '美团', value: 'meituan' },
    { label: '携程', value: 'ctrip' },
    { label: '飞猪', value: 'fliggy' },
    { label: '旅行社', value: 'agency' },
    { label: '其他', value: 'other' }
  ]

  const prepayOptions = [
    { label: '否', value: false },
    { label: '是', value: true }
  ]

  // 核心订单数据
  const orderData = ref({
    orderId: generateOrderNumber(),
    status: 'pending',
    orderSource: 'front_desk',
    sourceNumber: '',
    guestName: '',
    phone: '',
    roomType: null,
    roomNumber: null,
    checkInDate: date.formatDate(new Date(), 'YYYY-MM-DD'),
    checkOutDate: date.formatDate(date.addToDate(new Date(), { days: 1 }), 'YYYY-MM-DD'),
    deposit: 0,
    paymentMethod: viewStore.paymentMethodOptions[0]?.value || '现金',
    roomPrice: {},
    remarks: '',
    stayType: '客房',
    isRestRoom: false,
    isPrepaid: false,
    prepaidAmount: 0
  })

  return {
    orderData,
    statusOptions,
    sourceOptions,
    prepayOptions
  }
}
