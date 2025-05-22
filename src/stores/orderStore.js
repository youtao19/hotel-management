import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api' // 确保导入的是默认导出的api实例
import { useViewStore } from './viewStore'

export const useOrderStore = defineStore('order', () => {
  // 引入视图store以使用日期格式化函数
  const viewStore = useViewStore()

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
      const response = await api.get('/orders') // 移除 /api 前缀
      console.log('订单数据获取成功:', response) // response 本身就是拦截器处理后的数据
      // 确保从响应的 data 属性中获取数组 (如果后端直接返回 { data: [...] } 结构)
      // 如果后端直接返回数组，则不需要 .data.data
      const rawOrders = response && response.data ? response.data : (Array.isArray(response) ? response : [])
      // 映射后端字段到前端期望的字段名并处理日期格式
      orders.value = rawOrders.map(order => ({
        orderNumber: order.order_id,
        guestName: order.guest_name,
        phone: order.phone,
        idNumber: order.id_number,
        roomType: order.room_type,
        roomNumber: order.room_number,
        checkInDate: order.check_in_date,
        checkOutDate: order.check_out_date,
        status: order.status,
        paymentMethod: order.payment_method,
        roomPrice: order.room_price,
        deposit: order.deposit,
        createTime: order.create_time,
        remarks: order.remarks,
        actualCheckInTime: order.actual_check_in_time,
        actualCheckOutTime: order.actual_check_out_time,
        source: order.order_source,
        sourceNumber: order.id_source
      }))

      for (const order of orders.value) {
        if (order.checkOutDate && order.checkOutDate.includes('T')) {
          console.log(`订单 ${order.orderNumber} 退房日期格式: ${order.checkOutDate}`)
        }
      }
    } catch (err) {
      console.error('获取订单数据失败:', err.response ? err.response.data : err.message)
      // 检查 err.message 是否已经是 HTML 字符串
      const errorMessage = typeof err.message === 'string' && err.message.startsWith('<!DOCTYPE html>')
                          ? '获取订单数据失败: 后端返回HTML错误页面'
                          : (err.response?.data?.message || err.message || '获取订单数据失败');
      error.value = errorMessage;
      orders.value = []; // 获取失败时清空订单
    } finally {
      loading.value = false
    }
  }

  /**
   * 格式化订单中的日期
   * @param {string} dateString - 日期字符串
   * @returns {string} 格式化后的日期
   */
  function formatOrderDate(dateString) {
    return viewStore.formatDate(dateString)
  }

  // 添加新订单
  async function addOrder(order) {
    try {
      loading.value = true
      error.value = null

      // 确保status是有效的，如果前端传递的是中文，需要转换
      let statusValue = order.status;
      if (statusValue === '待入住') statusValue = 'pending';
      else if (statusValue === '已入住') statusValue = 'checked-in';
      else if (statusValue === '已退房') statusValue = 'checked-out';
      else if (statusValue === '已取消') statusValue = 'cancelled';

      // 确保日期是 ISO8601 格式
      let checkInDateISO = order.checkInDate;
      if (order.checkInDate && typeof order.checkInDate === 'string' && !order.checkInDate.includes('T')) {
        // 假设 YYYY-MM-DD，转为 UTC 午夜
        checkInDateISO = new Date(order.checkInDate + 'T00:00:00.000Z').toISOString();
      } else if (order.checkInDate) { // 如果已经是 Date 对象或带时间的字符串
        checkInDateISO = new Date(order.checkInDate).toISOString();
      }

      let checkOutDateISO = order.checkOutDate;
      if (order.checkOutDate && typeof order.checkOutDate === 'string' && !order.checkOutDate.includes('T')) {
        // 假设 YYYY-MM-DD，转为 UTC 午夜
        checkOutDateISO = new Date(order.checkOutDate + 'T00:00:00.000Z').toISOString();
      } else if (order.checkOutDate) { // 如果已经是 Date 对象或带时间的字符串
        checkOutDateISO = new Date(order.checkOutDate).toISOString();
      }

      const orderData = {
        orderNumber: order.orderNumber,
        guestName: order.guestName,
        phone: order.phone,
        idNumber: order.idNumber,
        roomType: order.roomType,
        roomNumber: order.roomNumber,
        checkInDate: checkInDateISO,
        checkOutDate: checkOutDateISO,
        status: statusValue,
        paymentMethod: typeof order.paymentMethod === 'object' ? order.paymentMethod.value : order.paymentMethod,
        roomPrice: order.roomPrice,
        deposit: order.deposit,
        remarks: order.remarks,
        source: order.source || '线下',
        sourceNumber: order.sourceNumber || '前台',
        createTime: order.createTime ? new Date(order.createTime).toISOString() : new Date().toISOString(),
        actualCheckInTime: order.actualCheckInTime ? new Date(order.actualCheckInTime).toISOString() : null,
        actualCheckOutTime: order.actualCheckOutTime ? new Date(order.actualCheckOutTime).toISOString() : null,
      }

      console.log('正在添加新订单 (确保日期为ISO):', orderData)
      const response = await api.post('/orders', orderData) // 移除 /api 前缀
      console.log('订单添加成功:', response) // response 是拦截器处理后的数据

      // 添加到本地状态，确保字段名一致
      // 后端返回的可能是 { message: '...', order: { ... } }
      const newOrderFromApi = response.order || response; // 取决于后端确切的响应结构
      const newOrderMapped = {
        orderNumber: newOrderFromApi.order_id,
        guestName: newOrderFromApi.guest_name,
        phone: newOrderFromApi.phone,
        idNumber: newOrderFromApi.id_number,
        roomType: newOrderFromApi.room_type,
        roomNumber: newOrderFromApi.room_number,
        checkInDate: newOrderFromApi.check_in_date,
        checkOutDate: newOrderFromApi.check_out_date,
        status: newOrderFromApi.status,
        paymentMethod: newOrderFromApi.payment_method,
        roomPrice: newOrderFromApi.room_price,
        deposit: newOrderFromApi.deposit,
        createTime: newOrderFromApi.create_time,
        remarks: newOrderFromApi.remarks,
        actualCheckInTime: newOrderFromApi.actual_check_in_time,
        actualCheckOutTime: newOrderFromApi.actual_check_out_time,
        source: newOrderFromApi.order_source,
        sourceNumber: newOrderFromApi.id_source,
      };
      orders.value.unshift(newOrderMapped)
      return newOrderMapped;
    } catch (err) {
      console.error('添加订单失败:', err.response ? err.response.data : err.message);
      error.value = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || '添加订单失败';
      throw err;
    } finally {
      loading.value = false
    }
  }

  // 获取所有订单 (本地)
  function getAllOrdersLocal() {
    return orders.value
  }

  /**
   * 更新订单状态 (通过API)
   * @param {string} orderNumber - 订单号
   * @param {string} newStatus - 新状态 ('pending', 'checked-in', 'checked-out', 'cancelled')
   * @param {object} [options] - 其他选项
   * @param {string} [options.checkInTime] - 入住时间 (ISO string)
   * @param {string} [options.checkOutTime] - 退房时间 (ISO string)
   */
  async function updateOrderStatusViaApi(orderNumber, newStatus, options = {}) {
    try {
      loading.value = true;
      error.value = null;
      console.log(`通过API更新订单 ${orderNumber} 状态为: ${newStatus}, 选项:`, options);

      const payload = { newStatus, ...options };
      if (payload.checkInTime && !(payload.checkInTime instanceof String)) {
        payload.checkInTime = new Date(payload.checkInTime).toISOString();
      }
      if (payload.checkOutTime && !(payload.checkOutTime instanceof String)){
        payload.checkOutTime = new Date(payload.checkOutTime).toISOString();
      }

      const response = await api.put(`/orders/${orderNumber}/status`, payload); // 移除 /api 前缀
      console.log('订单状态API更新成功:', response); // response 是拦截器处理后的数据

      // 更新本地状态
      // 后端返回的可能是 { message: '...', order: { ... } }
      const updatedOrderFromApi = response.order || response;
      const index = orders.value.findIndex(o => o.orderNumber === orderNumber);
      if (index !== -1) {
        orders.value[index].status = updatedOrderFromApi.status;
        if (updatedOrderFromApi.actual_check_in_time) {
          orders.value[index].actualCheckInTime = updatedOrderFromApi.actual_check_in_time;
        }
        if (updatedOrderFromApi.actual_check_out_time) {
          orders.value[index].actualCheckOutTime = updatedOrderFromApi.actual_check_out_time;
        }
        // 你可能还想更新其他从API返回的字段
        orders.value[index] = { ...orders.value[index], ...orders.value[index], actualCheckInTime: updatedOrderFromApi.actual_check_in_time, actualCheckOutTime: updatedOrderFromApi.actual_check_out_time, status: updatedOrderFromApi.status };

      }
      return updatedOrderFromApi;
    } catch (err) {
      console.error('通过API更新订单状态失败:', err.response ? err.response.data : err.message);
      error.value = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || '更新订单状态失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }


  // 更新订单状态 (本地, 主要用于前端快速反馈，如取消)
  function updateOrderStatusLocally(orderNumber, status) {
    const index = orders.value.findIndex(o => o.orderNumber === orderNumber)
    if (index !== -1) {
      orders.value[index].status = status
      if (status === 'cancelled' || status === 'pending') {
        orders.value[index].actualCheckInTime = null;
        orders.value[index].actualCheckOutTime = null;
      }
    }
  }

  // 更新订单退房信息 (本地)
  function updateOrderCheckOutLocally(orderNumber, checkOutTime) {
    const index = orders.value.findIndex(o => o.orderNumber === orderNumber)
    if (index !== -1) {
      orders.value[index].status = 'checked-out'
      orders.value[index].actualCheckOutTime = checkOutTime
    }
  }

  // 更新订单房间信息
  async function updateOrderRoom(orderNumber, roomType, roomNumber, roomPrice) {
    try {
      console.log(`更新订单 ${orderNumber} 房间信息:`, { roomType, roomNumber, roomPrice })
      const roomData = {
        newRoomType: roomType,
        newRoomNumber: roomNumber,
        newRoomPrice: roomPrice
      }
      // 移除 /api 前缀, 并确保后端API路径正确
      // const response = await api.put(`/orders/${orderNumber}/room`, roomData);
      // console.log('订单房间信息更新成功:', response.data);

      const index = orders.value.findIndex(o => o.orderNumber === orderNumber)
      if (index !== -1) {
        orders.value[index].roomType = roomType
        orders.value[index].roomNumber = roomNumber
        orders.value[index].roomPrice = roomPrice
      }
      return true;
    } catch (err) {
      console.error('更新订单房间信息失败:', err.response ? err.response.data : err.message)
      error.value = '更新订单房间信息失败'
      return false
    }
  }

  // 获取特定订单
  function getOrderByNumber(orderNumber) {
    return orders.value.find(order => order.orderNumber === orderNumber)
  }

  // 获取特定房间号的活跃订单（待入住或已入住状态）
  function getActiveOrderByRoomNumber(roomNumber) {
    return orders.value.find(order =>
      order.roomNumber === roomNumber &&
      (order.status === 'pending' || order.status === 'checked-in')
    )
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
    getAllOrdersLocal,
    fetchAllOrders,
    updateOrderStatusLocally,
    updateOrderStatusViaApi,
    updateOrderCheckOutLocally,
    updateOrderRoom,
    getOrderByNumber,
    getActiveOrderByRoomNumber,
    formatOrderDate
  }
})
