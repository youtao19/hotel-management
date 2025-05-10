import { defineStore } from 'pinia'
import { ref } from 'vue'
import { orderApi } from '../api'

export const useOrderStore = defineStore('order', () => {
  // 订单列表
  const orders = ref([])
  // 加载状态
  const loading = ref(false)
  // 错误信息
  const error = ref(null)

  // 获取所有订单
  async function fetchAllOrders() {
    try {
      loading.value = true
      error.value = null
      console.log('开始获取订单数据...')
      const response = await orderApi.getAllOrders()
      console.log('订单数据获取成功:', response)
      orders.value = response.data || []
    } catch (err) {
      console.error('获取订单数据失败:', err)
      error.value = '获取订单数据失败'
    } finally {
      loading.value = false
    }
  }

  // 添加新订单
  async function addOrder(order) {
    try {
      loading.value = true
      error.value = null

      // 将状态翻译为中文
      let statusText = '待入住'
      if (order.status === 'checked-in') statusText = '已入住'
      else if (order.status === 'checked-out') statusText = '已退房'
      else if (order.status === 'cancelled') statusText = '已取消'

      const orderData = {
        // 适配数据库字段名
        guest_name: order.guestName,
        phone: order.phone,
        id_number: order.idNumber,
        room_type: order.roomType,
        room_number: order.roomNumber,
        check_in_date: order.checkInDate,
        check_out_date: order.checkOutDate,
        status: statusText,
        payment_method: order.paymentMethod,
        room_price: order.roomPrice,
        deposit: order.deposit,
        remarks: order.remarks,
        id_source: order.idSource || '前台',
        order_source: order.orderSource || '线下'
      }

      console.log('正在添加新订单:', orderData)
      const response = await orderApi.addOrder(orderData)
      console.log('订单添加成功:', response)

      // 添加到本地状态
      orders.value.unshift(response.data)
      return response.data
    } catch (err) {
      console.error('添加订单失败:', err)
      error.value = '添加订单失败'
      return null
    } finally {
      loading.value = false
    }
  }

  // 获取所有订单
  function getAllOrders() {
    return orders.value
  }

  // 更新订单状态
  async function updateOrderStatus(orderNumber, status) {
    try {
      console.log(`更新订单 ${orderNumber} 状态为: ${status}`)
      await orderApi.updateOrderStatus(orderNumber, status)
      // 更新本地状态
      const index = orders.value.findIndex(o => o.order_id === orderNumber)
      if (index !== -1) {
        orders.value[index].status = status
      }
      return true
    } catch (err) {
      console.error('更新订单状态失败:', err)
      return false
    }
  }

  // 更新订单状态并记录入住时间
  async function updateOrderCheckIn(orderNumber, checkInTime) {
    try {
      console.log(`订单 ${orderNumber} 办理入住, 时间: ${checkInTime}`)
      await orderApi.checkIn(orderNumber, { checkInTime })
      // 更新本地状态
      const index = orders.value.findIndex(o => o.order_id === orderNumber)
      if (index !== -1) {
        orders.value[index].status = '已入住'
        orders.value[index].actual_check_in_time = checkInTime
      }
      return true
    } catch (err) {
      console.error('更新订单入住信息失败:', err)
      return false
    }
  }

  // 更新订单状态并记录退房时间
  async function updateOrderCheckOut(orderNumber, checkOutTime) {
    try {
      console.log(`订单 ${orderNumber} 办理退房, 时间: ${checkOutTime}`)
      await orderApi.checkOut(orderNumber, { checkOutTime })
      // 更新本地状态
      const index = orders.value.findIndex(o => o.order_id === orderNumber)
      if (index !== -1) {
        orders.value[index].status = '已退房'
        orders.value[index].actual_check_out_time = checkOutTime
      }
      return true
    } catch (err) {
      console.error('更新订单退房信息失败:', err)
      return false
    }
  }

  // 更新订单房间信息
  async function updateOrderRoom(orderNumber, roomType, roomNumber, roomPrice) {
    try {
      console.log(`更新订单 ${orderNumber} 房间信息:`, { roomType, roomNumber, roomPrice })
      const roomData = {
        roomType,
        roomNumber,
        roomPrice
      }

      await orderApi.updateOrderRoom(orderNumber, roomData)

      // 更新本地状态
      const index = orders.value.findIndex(o => o.order_id === orderNumber)
      if (index !== -1) {
        orders.value[index].room_type = roomType
        orders.value[index].room_number = roomNumber
        orders.value[index].room_price = roomPrice

        // 添加房间变更记录
        const changeRecord = {
          time: new Date().toISOString(),
          oldRoom: orders.value[index].room_number,
          newRoom: roomNumber
        }
        if (!orders.value[index].room_changes) {
          orders.value[index].room_changes = []
        }
        orders.value[index].room_changes.push(changeRecord)
        return true
      }
      return false
    } catch (err) {
      console.error('更新订单房间信息失败:', err)
      return false
    }
  }

  // 初始加载数据
  function initialize() {
    console.log('开始初始化订单数据...')
    fetchAllOrders()
      .then(() => {
        console.log('订单数据初始化完成')
      })
      .catch(err => {
        console.error('订单数据初始化失败:', err)
      })
  }

  // 初始化
  initialize()

  return {
    orders,
    loading,
    error,
    addOrder,
    getAllOrders,
    fetchAllOrders,
    updateOrderStatus,
    updateOrderCheckIn,
    updateOrderCheckOut,
    updateOrderRoom
  }
})
