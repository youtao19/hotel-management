import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useOrderStore = defineStore('order', () => {
  // 订单列表
  const orders = ref([
    {
      orderNumber: 'O20230610001',
      guestName: '张三',
      phone: '13812345678',
      idNumber: '110101199001011234',
      roomType: 'standard',
      roomNumber: '101',
      checkInDate: '2023-06-10',
      checkOutDate: '2023-06-12',
      status: '已退房',
      paymentMethod: 'cash',
      roomPrice: 576,
      deposit: 200,
      createTime: '2023-06-10 14:30:00',
      remarks: ''
    },
    {
      orderNumber: 'O20230615002',
      guestName: '李四',
      phone: '13987654321',
      idNumber: '310101199203034321',
      roomType: 'deluxe',
      roomNumber: '201',
      checkInDate: '2023-06-15',
      checkOutDate: '2023-06-18',
      status: '已入住',
      paymentMethod: 'wechat',
      roomPrice: 1164,
      deposit: 300,
      createTime: '2023-06-15 10:15:00',
      remarks: '客人需要加床'
    },
    // ... 其他订单示例
  ])

  // 添加新订单
  function addOrder(order) {
    // 添加创建时间
    const now = new Date()
    const createTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    
    // 将状态翻译为中文
    let statusText = '待入住'
    if (order.status === 'checked-in') statusText = '已入住'
    else if (order.status === 'checked-out') statusText = '已退房'
    else if (order.status === 'cancelled') statusText = '已取消'
    
    // 添加到订单列表
    orders.value.unshift({
      ...order,
      status: statusText,
      createTime
    })
  }

  // 获取所有订单
  function getAllOrders() {
    return orders.value
  }

  // 更新订单状态
  function updateOrderStatus(orderNumber, status) {
    const index = orders.value.findIndex(o => o.orderNumber === orderNumber)
    if (index !== -1) {
      orders.value[index].status = status
    }
  }

  // 更新订单状态并记录入住时间
  function updateOrderCheckIn(orderNumber, checkInTime) {
    const index = orders.value.findIndex(o => o.orderNumber === orderNumber)
    if (index !== -1) {
      orders.value[index].status = '已入住'
      orders.value[index].actualCheckInTime = checkInTime
    }
  }

  return {
    orders,
    addOrder,
    getAllOrders,
    updateOrderStatus,
    updateOrderCheckIn
  }
}) 