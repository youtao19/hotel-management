import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useViewStore } from './viewStore'
import { orderApi } from '../api'

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
      const response = await orderApi.getAllOrders() // 移除 /api 前缀
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

      // 打印订单数据
      // for (const order of orders.value) {
      //   if (order.checkOutDate && order.checkOutDate.includes('T')) {
      //     console.log(`订单 ${order.orderNumber} 退房日期格式: ${order.checkOutDate}`)
      //   }
      // }
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

      // 打印接收到的原始订单数据
      console.log('接收到的原始订单数据:', JSON.stringify(order, null, 2));

      // 数据验证
      if (!order) {
        throw new Error('订单数据不能为空');
      }

      // 确保status是有效的，如果前端传递的是中文，需要转换
      let statusValue = order.status || 'pending'; // 默认为待入住
      if (statusValue === '待入住') statusValue = 'pending';
      else if (statusValue === '已入住') statusValue = 'checked-in';
      else if (statusValue === '已退房') statusValue = 'checked-out';
      else if (statusValue === '已取消') statusValue = 'cancelled';

      // 确保日期是 ISO8601 格式
      let checkInDateISO = null;
      if (order.checkInDate) {
        try {
          checkInDateISO = new Date(order.checkInDate).toISOString();
        } catch (e) {
          console.error('入住日期格式错误:', order.checkInDate);
          throw new Error('入住日期格式错误');
        }
      }

      let checkOutDateISO = null;
      if (order.checkOutDate) {
        try {
          checkOutDateISO = new Date(order.checkOutDate).toISOString();
        } catch (e) {
          console.error('退房日期格式错误:', order.checkOutDate);
          throw new Error('退房日期格式错误');
        }
      }

      // 构建要发送到后端的数据，进行字段名映射
      const orderData = {
        order_id: order.orderNumber?.toString(),          // 从 orderNumber 映射，确保是字符串
        guest_name: order.guestName?.toString(),          // 从 guestName 映射，确保是字符串
        phone: order.phone?.toString(),                   // 确保是字符串
        id_number: order.idNumber?.toString(),            // 从 idNumber 映射，确保是字符串
        room_type: order.roomType?.toString(),            // 从 roomType 映射，确保是字符串
        room_number: order.roomNumber?.toString(),        // 从 roomNumber 映射，确保是字符串
        check_in_date: checkInDateISO,                    // 从 checkInDate 映射
        check_out_date: checkOutDateISO,                  // 从 checkOutDate 映射
        status: statusValue,
        payment_method: typeof order.paymentMethod === 'object' ? order.paymentMethod.value?.toString() : order.paymentMethod?.toString(),
        room_price: parseFloat(order.roomPrice) || 0,     // 确保是数字
        deposit: parseFloat(order.deposit) || 0,          // 确保是数字
        remarks: order.remarks?.toString() || '',
        order_source: order.source?.toString() || 'front_desk',  // 从 source 映射，确保是字符串
        id_source: order.sourceNumber?.toString() || '',   // 从 sourceNumber 映射，确保是字符串
        create_time: new Date().toISOString(),            // 使用当前时间
        actual_check_in_time: null,
        actual_check_out_time: null,
      }

      // 打印准备发送的数据
      console.log('准备发送到后端的数据:', JSON.stringify(orderData, null, 2));

      // 验证必填字段
      const requiredFields = ['order_id', 'guest_name', 'id_number', 'room_type', 'room_number', 'check_in_date', 'check_out_date', 'room_price'];
      const missingFields = requiredFields.filter(field => !orderData[field]);

      if (missingFields.length > 0) {
        console.error('缺少必填字段:', missingFields);
        throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
      }

      // 验证身份证号长度
      if (!orderData.id_number || orderData.id_number.length !== 18) {
        console.error('身份证号无效:', orderData.id_number);
        throw new Error('身份证号必须为18位');
      }

      // 验证手机号长度
      if (orderData.phone && orderData.phone.length !== 11) {
        console.error('手机号无效:', orderData.phone);
        throw new Error('手机号必须为11位');
      }

      console.log('正在添加新订单 (确保日期为ISO):', JSON.stringify(orderData, null, 2));
      const response = await orderApi.addOrder(orderData);
      console.log('订单添加成功:', response);

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

      // 使用 orderApi 而不是直接使用 api
      const response = await orderApi.updateOrderStatus(orderNumber, payload);
      console.log('订单状态API更新成功:', response);

      // 更新本地状态
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
        orders.value[index] = {
          ...orders.value[index],
          actualCheckInTime: updatedOrderFromApi.actual_check_in_time,
          actualCheckOutTime: updatedOrderFromApi.actual_check_out_time,
          status: updatedOrderFromApi.status
        };
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
