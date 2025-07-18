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
      const response = await orderApi.getAllOrders() // 移除 /api 前缀
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
        // 格式化日期，确保统一格式（YYYY-MM-DD）
        checkInDate: formatOrderDate(order.check_in_date),
        checkOutDate: formatOrderDate(order.check_out_date),
        status: order.status,
        paymentMethod: order.payment_method,
        roomPrice: order.room_price,
        deposit: order.deposit,
        refundedDeposit: order.refunded_deposit || 0,
        refundRecords: order.refund_records || [],
        createTime: order.create_time,
        remarks: order.remarks,
        source: order.order_source,
        sourceNumber: order.id_source
      }))
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
        payment_method: viewStore.normalizePaymentMethodForDB(typeof order.paymentMethod === 'object' ? order.paymentMethod.value?.toString() : order.paymentMethod?.toString()),
        room_price: parseFloat(order.roomPrice) || 0,     // 确保是数字
        deposit: parseFloat(order.deposit) || 0,          // 确保是数字
        remarks: order.remarks?.toString() || '',
        order_source: order.source?.toString() || 'front_desk',  // 从 source 映射，确保是字符串
        id_source: order.sourceNumber?.toString() || '',   // 从 sourceNumber 映射，确保是字符串
        create_time: new Date().toISOString(),            // 使用当前时间
      }


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

      const response = await orderApi.addOrder(orderData);

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
   * @param {object} [options] - 其他选项 (已废弃，保留以兼容现有代码)
   */
  async function updateOrderStatusViaApi(orderNumber, newStatus, options = {}) {
    try {
      loading.value = true;
      error.value = null;
      // 构建状态更新数据
      const statusData = { newStatus };

      // 发送请求
      const response = await orderApi.updateOrderStatus(orderNumber, statusData);

      // 更新本地状态
      const updatedOrderFromApi = response.order || response;
      const index = orders.value.findIndex(o => o.orderNumber === orderNumber);
      if (index !== -1) {
        // 确保日期字段被正确格式化
        orders.value[index] = {
          ...orders.value[index],
          status: updatedOrderFromApi.status,
          // 如果API返回了更新的日期字段，使用它们，并确保格式化
          checkInDate: updatedOrderFromApi.check_in_date ? formatOrderDate(updatedOrderFromApi.check_in_date) : orders.value[index].checkInDate,
          checkOutDate: updatedOrderFromApi.check_out_date ? formatOrderDate(updatedOrderFromApi.check_out_date) : orders.value[index].checkOutDate
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
    }
  }

  // 更新订单退房信息 (本地) - 已废弃，保留以兼容现有代码
  function updateOrderCheckOutLocally(orderNumber, checkOutTime) {
    const index = orders.value.findIndex(o => o.orderNumber === orderNumber)
    if (index !== -1) {
      orders.value[index].status = 'checked-out'
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

  // 创建新订单 (续住专用)
  async function createOrder(orderData) {
    try {
      console.log('🏨 创建续住订单开始:', orderData);

      // 将续住订单数据转换为适合addOrder的格式
      const convertedOrderData = {
        orderNumber: orderData.orderNumber,
        guestName: orderData.guestName,
        phone: orderData.phone,
        idNumber: orderData.idNumber || '000000000000000000', // 续住时可能没有身份证号，使用默认值
        roomType: orderData.roomType,
        roomNumber: orderData.roomNumber,
        checkInDate: orderData.checkInDate,
        checkOutDate: orderData.checkOutDate,
        status: orderData.status || 'pending',
        paymentMethod: orderData.paymentMethod || 'cash',
        roomPrice: orderData.totalPrice ? (orderData.totalPrice / orderData.stayDays || 1) : (orderData.roomPrice || 0),
        deposit: 0, // 续住默认押金为0
        remarks: orderData.notes || '',
        source: 'extend_stay', // 标记为续住来源
        sourceNumber: orderData.originalOrderNumber || ''
      };

      console.log('🔄 转换后的订单数据:', convertedOrderData);

      // 调用现有的addOrder方法
      const createdOrder = await addOrder(convertedOrderData);
      console.log('✅ 续住订单创建成功:', createdOrder);
      return createdOrder;

    } catch (error) {
      console.error('❌ 创建续住订单失败:', error);
      throw error;
    }
  }

  // 退押金
  async function refundDeposit(refundData) {
    try {
      loading.value = true;
      error.value = null;

      console.log('💰 处理退押金请求:', refundData);

      // 调用API
      const response = await orderApi.refundDeposit(refundData.orderNumber, refundData);

      // 更新本地订单数据
      const orderIndex = orders.value.findIndex(order => order.orderNumber === refundData.orderNumber);
      if (orderIndex !== -1) {
        const currentRefunded = orders.value[orderIndex].refundedDeposit || 0;
        orders.value[orderIndex] = {
          ...orders.value[orderIndex],
          refundedDeposit: currentRefunded + refundData.actualRefundAmount,
          refundRecords: [
            ...(orders.value[orderIndex].refundRecords || []),
            {
              refundTime: refundData.refundTime,
              actualRefundAmount: refundData.actualRefundAmount,
              method: refundData.method,
              operator: refundData.operator,
              notes: refundData.notes || ''
            }
          ]
        };
      }

      console.log('✅ 退押金处理成功:', response);
      return response;

    } catch (err) {
      console.error('❌ 退押金处理失败:', err);
      error.value = err.response?.data?.message || err.message || '退押金处理失败';
      throw err;
    } finally {
      loading.value = false;
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

  // 不再自动初始化，由组件控制初始化时机
  // initialize()

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
    formatOrderDate,
    createOrder,
    refundDeposit
  }
})
