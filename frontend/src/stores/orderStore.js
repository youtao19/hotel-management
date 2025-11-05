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

  // 防重入：共享进行中的获取请求，避免并发拉取导致级联触发
  let inFlightFetchAll = null

  // 获取所有订单
  async function fetchAllOrders(retryCount = 0) {
    if (inFlightFetchAll) {
      try { return await inFlightFetchAll } finally { }
    }
    inFlightFetchAll = (async () => {
      try {
        loading.value = true
        error.value = null
        console.log('开始获取订单数据...')

        const response = await orderApi.getAllOrders()

        const rawOrders = response && response.data ? response.data : (Array.isArray(response) ? response : [])
        console.log(`成功获取 ${rawOrders.length} 条订单数据`)

        orders.value = rawOrders.map(order => ({
          orderNumber: order.order_id,
          guestName: order.guest_name,
          phone: order.phone,
          roomType: order.room_type,
          roomNumber: order.room_number,
          checkInDate: formatOrderDate(order.check_in_date),
          checkOutDate: formatOrderDate(order.check_out_date),
          status: order.status,
          paymentMethod: order.payment_method,
          roomPrice: order.total_price,
          deposit: order.deposit,
          refundedDeposit: order.refunded_deposit || 0,
          refundRecords: [],
          createTime: order.create_time,
          remarks: order.remarks,
          source: order.order_source,
          sourceNumber: order.id_source,
          isPrepaid: Boolean(order.is_prepaid),
          prepaidAmount: parseFloat(order.prepaid_amount) || 0,
          prepaidAt: order.prepaid_at
        }))

        return orders.value
      } catch (err) {
        console.error('获取订单数据失败:', err.response ? err.response.data : err.message)

        if (err.code === 'ECONNABORTED' && err.message.includes('timeout') && retryCount < 2) {
          console.log(`订单数据请求超时，正在进行第 ${retryCount + 1} 次重试...`)
          return await fetchAllOrders(retryCount + 1)
        }

        const errorMessage = typeof err.message === 'string' && err.message.startsWith('<!DOCTYPE html>')
                          ? '获取订单数据失败: 后端返回HTML错误页面'
                          : (err.response?.data?.message || err.message || '获取订单数据失败')

        error.value = errorMessage
        if (!orders.value.length) {
          orders.value = []
        }

        throw err
      } finally {
        loading.value = false
      }
    })()
    try {
      return await inFlightFetchAll
    } finally {
      inFlightFetchAll = null
    }
  }

  function formatOrderDate(dateString) {
    return viewStore.formatDate(dateString)
  }

  async function addOrder(order) {
    try {
      loading.value = true
      error.value = null

      if (!order) {
        throw new Error('订单数据不能为空');
      }

      let statusValue = order.status || 'pending';
      if (statusValue === '待入住') statusValue = 'pending';
      else if (statusValue === '已入住') statusValue = 'checked-in';
      else if (statusValue === '已退房') statusValue = 'checked-out';
      else if (statusValue === '已取消') statusValue = 'cancelled';

      const strictDateRegex = /^\d{4}-\d{2}-\d{2}$/;

      function normalizeDateInput(input) {
        if (!input) return null;
        if (input instanceof Date) {
          const y = input.getFullYear();
          const m = String(input.getMonth() + 1).padStart(2, '0');
          const d = String(input.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        let s = String(input).trim();
        if (s.includes('/')) s = s.replaceAll('/', '-');
        const loose = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
        const m = s.match(loose);
        if (m) {
          const year = m[1];
          const month = m[2].padStart(2, '0');
          const day = m[3].padStart(2, '0');
          const normalized = `${year}-${month}-${day}`;
          return normalized;
        }
        return s;
      }

      function assertValidDate(str, label) {
        if (!strictDateRegex.test(str)) {
          console.error(`${label}格式错误:`, str);
          throw new Error(`${label}格式错误`);
        }
        const [y, m, d] = str.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
          console.error(`${label}无效日期:`, str);
            throw new Error(`${label}无效日期`);
        }
      }

      let checkInDateISO = null;
      if (order.checkInDate) {
        checkInDateISO = normalizeDateInput(order.checkInDate);
        assertValidDate(checkInDateISO, '入住日期');
      }

      let checkOutDateISO = null;
      if (order.checkOutDate) {
        checkOutDateISO = normalizeDateInput(order.checkOutDate);
        assertValidDate(checkOutDateISO, '退房日期');
      }

      const isPrepaid = Boolean(order.isPrepaid);
      const prepaidAmount = isPrepaid ? parseFloat(order.prepaidAmount) || 0 : 0;
      if (isPrepaid && !(prepaidAmount > 0)) {
        throw new Error('预收房费金额必须大于0');
      }
      let prepaidAtISO;
      if (isPrepaid) {
        const rawPrepaidAt = order.prepaidAt || new Date().toISOString();
        const parsedPrepaidAt = new Date(rawPrepaidAt);
        if (Number.isNaN(parsedPrepaidAt.getTime())) {
          throw new Error('预收房费时间无效');
        }
        prepaidAtISO = parsedPrepaidAt.toISOString();
      }

      const orderData = {
        order_id: order.orderNumber?.toString(),
        guest_name: order.guestName?.toString(),
        phone: order.phone?.toString() || '',
        room_type: order.roomType?.toString(),
        room_number: order.roomNumber?.toString(),
        check_in_date: checkInDateISO,
        check_out_date: checkOutDateISO,
        status: statusValue,
        payment_method: viewStore.normalizePaymentMethodForDB(typeof order.paymentMethod === 'object' ? order.paymentMethod.value?.toString() : order.paymentMethod?.toString()),
        total_price: order.roomPrice,
        deposit: parseFloat(order.deposit) || 0,
        remarks: order.remarks?.toString() || '',
        order_source: order.source?.toString() || 'front_desk',
        id_source: order.sourceNumber?.toString() || '',
        create_time: new Date().toISOString(),
        is_prepaid: isPrepaid,
        prepaid_amount: prepaidAmount,
      }
      if (prepaidAtISO) {
        orderData.prepaid_at = prepaidAtISO;
      }

      const requiredFields = ['order_id', 'guest_name', 'room_type', 'room_number', 'check_in_date', 'check_out_date', 'total_price'];
      const missingFields = requiredFields.filter(field => {
        const value = orderData[field];
        if (field === 'total_price') {
          if (typeof value === 'number') {
            return value <= 0;
          } else if (typeof value === 'object' && value !== null) {
            const isEmpty = Object.keys(value).length === 0;
            const hasInvalidPrices = Object.values(value).some(price => !price || parseFloat(price) <= 0);
            return isEmpty || hasInvalidPrices;
          }
          return !value;
        }
        return !value;
      });

      if (missingFields.length > 0) {
        console.error('缺少必填字段:', missingFields);
        throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
      }

      // 手机号如果提供，验证格式（可选）
      if (orderData.phone && orderData.phone.length > 0 && orderData.phone.length !== 11) {
        console.error('手机号无效:', orderData.phone);
        throw new Error('手机号必须为11位');
      }

      const response = await orderApi.addOrder(orderData);

      console.log('🔍 后端返回的原始数据:', response);

      const newOrderFromApi = response.order || response;
      console.log('🔍 提取的订单数据:', newOrderFromApi);

      const newOrderMapped = {
        orderNumber: newOrderFromApi.order_id,
        guestName: newOrderFromApi.guest_name,
        phone: newOrderFromApi.phone,
        roomType: newOrderFromApi.room_type,
        roomNumber: newOrderFromApi.room_number,
        checkInDate: newOrderFromApi.check_in_date,
        checkOutDate: newOrderFromApi.check_out_date,
        status: newOrderFromApi.status,
        paymentMethod: newOrderFromApi.payment_method,
        roomPrice: newOrderFromApi.total_price,
        deposit: newOrderFromApi.deposit,
        createTime: newOrderFromApi.create_time,
        remarks: newOrderFromApi.remarks,
        source: newOrderFromApi.order_source,
        sourceNumber: newOrderFromApi.id_source,
        isPrepaid: Boolean(newOrderFromApi.is_prepaid),
        prepaidAmount: parseFloat(newOrderFromApi.prepaid_amount) || 0,
        prepaidAt: newOrderFromApi.prepaid_at
      };

      console.log('🔍 映射后的订单数据:', newOrderMapped);
      orders.value.unshift(newOrderMapped)
      return newOrderMapped;
    } catch (err) {
      const backend = err.response?.data;
      console.error('添加订单失败:', backend || err.message);
      const code = backend?.error?.code || backend?.error?.details || backend?.code;
      const msg = backend?.message || backend?.error?.details || backend?.error?.message || err.message;
      const combined = code ? `[${code}] ${msg}` : msg;
      const userMessage = combined || '添加订单失败';
      error.value = userMessage;

      if (err.isAxiosError && err.response) {
        err.userFacingMessage = userMessage;
        throw err;
      }

      throw new Error(userMessage);
    } finally {
      loading.value = false
    }
  }

  function getAllOrdersLocal() {
    return orders.value
  }

  async function updateOrderStatusViaApi(orderNumber, newStatus) {
    try {
      loading.value = true;
      error.value = null;
      const targetOrderId = orderNumber || ''
      if (!targetOrderId) {
        throw new Error('订单号无效，无法更新状态');
      }
      const statusData = { newStatus };
      const response = await orderApi.updateOrderStatus(targetOrderId, statusData);
      const updatedOrderFromApi = response.order || response;
      const normalizedOrderId = updatedOrderFromApi.order_id || updatedOrderFromApi.orderNumber || targetOrderId;
      const index = orders.value.findIndex(o => o.orderNumber === normalizedOrderId);
      if (index !== -1) {
        orders.value[index] = {
          ...orders.value[index],
          status: updatedOrderFromApi.status,
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

  function updateOrderStatusLocally(orderNumber, status) {
    const index = orders.value.findIndex(o => o.orderNumber === orderNumber)
    if (index !== -1) {
      orders.value[index].status = status
    }
  }

  function updateOrderCheckOutLocally(orderNumber, checkOutTime) {
    const index = orders.value.findIndex(o => o.orderNumber === orderNumber)
    if (index !== -1) {
      orders.value[index].status = 'checked-out'
    }
  }

  async function updateOrderRoom(orderNumber, roomType, roomNumber, roomPrice) {
    try {
      console.log(`更新订单 ${orderNumber} 房间信息:`, { roomType, roomNumber, roomPrice })
      const roomData = {
        newRoomType: roomType,
        newRoomNumber: roomNumber,
        newRoomPrice: roomPrice
      }
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

  async function getOrderByNumber(orderNumber, forceRefresh = false) {
    if (!forceRefresh) {
      const localOrder = orders.value.find(order => order.orderNumber === orderNumber)
      if (localOrder) return localOrder
    }

    try {
      loading.value = true
      const response = await orderApi.getOrderById(orderNumber)
      const orderData = response.data

      if (orderData) {
        const mappedOrder = {
          orderNumber: orderData.order_id,
          guestName: orderData.guest_name,
          phone: orderData.phone,
          roomType: orderData.room_type,
          roomNumber: orderData.room_number,
          checkInDate: formatOrderDate(orderData.check_in_date),
          checkOutDate: formatOrderDate(orderData.check_out_date),
          status: orderData.status,
          paymentMethod: orderData.payment_method,
          roomPrice: orderData.total_price,
          deposit: orderData.deposit,
          refundedDeposit: orderData.refunded_deposit || 0,
          refundRecords: [],
          createTime: orderData.create_time,
          remarks: orderData.remarks,
          source: orderData.order_source,
          sourceNumber: orderData.id_source,
          isPrepaid: Boolean(orderData.is_prepaid),
          prepaidAmount: parseFloat(orderData.prepaid_amount) || 0,
          prepaidAt: orderData.prepaid_at
        }

        const index = orders.value.findIndex(o => o.orderNumber === orderNumber)
        if (index !== -1) {
          orders.value[index] = mappedOrder
        } else {
          orders.value.push(mappedOrder)
        }

        return mappedOrder
      }
      return null
    } catch (err) {
      console.error(`获取订单 ${orderNumber} 失败:`, err)
      return orders.value.find(order => order.orderNumber === orderNumber) || null
    } finally {
      loading.value = false
    }
  }

  async function updateOrder(orderNumber, updatedFields) {
    try {
      loading.value = true;
      error.value = null;

      const payload = { ...updatedFields };
      const map = {
        guestName: 'guest_name',
        phone: 'phone',
        roomType: 'room_type',
        roomNumber: 'room_number',
        checkInDate: 'check_in_date',
        checkOutDate: 'check_out_date',
        status: 'status',
        paymentMethod: 'payment_method',
        total_price: 'total_price',  // 直接映射 total_price
        deposit: 'deposit',
        remarks: 'remarks'
      };
      const body = {};

      Object.keys(map).forEach(k => {
        if (payload[k] !== undefined) {
          body[map[k]] = payload[k];
        }
      });

      // roomPrice 不映射到数据库字段，它只用于前端显示

      const dateKeys = ['check_in_date', 'check_out_date'];
      dateKeys.forEach(k => {
        if (body[k]) body[k] = formatOrderDate(body[k]);
      });

      console.log('发送订单更新请求:', orderNumber, body);

      const resp = await orderApi.updateOrder(orderNumber, body);
      const updated = resp?.data || resp;

      console.log('订单更新成功:', updated);

      const idx = orders.value.findIndex(o => o.orderNumber === orderNumber);
      if (idx !== -1) {
        const merged = {
          ...orders.value[idx],
          guestName: updated.guest_name ?? orders.value[idx].guestName,
          phone: updated.phone ?? orders.value[idx].phone,
          roomType: updated.room_type ?? orders.value[idx].roomType,
          roomNumber: updated.room_number ?? orders.value[idx].roomNumber,
          checkInDate: updated.check_in_date ? formatOrderDate(updated.check_in_date) : orders.value[idx].checkInDate,
          checkOutDate: updated.check_out_date ? formatOrderDate(updated.check_out_date) : orders.value[idx].checkOutDate,
          paymentMethod: updated.payment_method ?? orders.value[idx].paymentMethod,
          roomPrice: updated.total_price ?? orders.value[idx].roomPrice,
          deposit: updated.deposit ?? orders.value[idx].deposit,
          remarks: updated.remarks ?? orders.value[idx].remarks,
          isPrepaid: updated.is_prepaid ?? orders.value[idx].isPrepaid,
          prepaidAmount: updated.prepaid_amount !== undefined ? (parseFloat(updated.prepaid_amount) || 0) : orders.value[idx].prepaidAmount,
          prepaidAt: updated.prepaid_at ?? orders.value[idx].prepaidAt
        };
        orders.value[idx] = merged;
      }

      return updated;
    } catch (err) {
      console.error('更新订单失败:', err.response?.data || err.message);
      error.value = err.response?.data?.message || err.message || '更新订单失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function getActiveOrderByRoomNumber(roomNumber) {
    return orders.value.find(order =>
      order.roomNumber === roomNumber &&
      (order.status === 'pending' || order.status === 'checked-in')
    )
  }

  async function createExtendStayOrder(orderData) {
    try {
      console.log('🏨 创建续住订单开始:', orderData);

      const convertedOrderData = {
        orderNumber: orderData.orderNumber,
        guestName: orderData.guestName,
        phone: orderData.phone || '',
        roomType: orderData.roomType,
        roomNumber: orderData.roomNumber,
        checkInDate: orderData.checkInDate,
        checkOutDate: orderData.checkOutDate,
        status: orderData.status || 'pending',
        paymentMethod: orderData.paymentMethod || 'cash',
        roomPrice: orderData.totalPrice ? (orderData.totalPrice / orderData.stayDays || 1) : (orderData.roomPrice || 0),
        deposit: 0,
        remarks: orderData.notes || '',
        source: 'extend_stay',
        sourceNumber: orderData.originalOrderNumber || ''
      };

      console.log('🔄 转换后的订单数据:', convertedOrderData);

      const createdOrder = await addOrder(convertedOrderData);
      console.log('✅ 续住订单创建成功:', createdOrder);
      return createdOrder;

    } catch (error) {
      console.error('❌ 创建续住订单失败:', error);
      throw error;
    }
  }

  async function refundDeposit(refundData) {
    try {
      loading.value = true;
      error.value = null;

      console.log('💰 处理退押金请求:', refundData);

      const response = await orderApi.refundDeposit(refundData.order_id, refundData);
      console.log('✅ 退押金处理成功:', response);

      try {
        const dep = await orderApi.getDepositInfo(refundData.order_id);
        const orderIndex = orders.value.findIndex(order => order.order_id === refundData.order_id);
        if (orderIndex !== -1 && dep?.data) {
          orders.value[orderIndex].refundedDeposit = dep.data.refunded;
          orders.value[orderIndex].deposit = dep.data.deposit;
        }
      } catch (e) {
        console.warn('刷新押金状态失败:', e.message);
      }
      return response;

    } catch (err) {
      console.error('❌ 退押金处理失败:', err);
      const resp = err.response?.data;
      if (resp?.availableRefund !== undefined && resp?.originalDeposit !== undefined) {
        const orderIndex = orders.value.findIndex(o => o.orderNumber === refundData.orderNumber);
        if (orderIndex !== -1) {
          const computedRefunded = resp.originalDeposit - resp.availableRefund;
          orders.value[orderIndex].refundedDeposit = computedRefunded;
          orders.value[orderIndex].deposit = resp.originalDeposit;
        }
      }
      error.value = resp?.message || err.message || '退押金处理失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function checkIn(orderNumber, depositAmount) {
    try {
      loading.value = true;
      error.value = null;
      console.log(`🚀 开始办理入住，订单号: ${orderNumber}, 押金: ${depositAmount}`);

      const checkInData = depositAmount !== undefined ? { deposit: depositAmount } : {};
      const result = await orderApi.checkIn(orderNumber, checkInData);

      const index = orders.value.findIndex(o => o.orderNumber === orderNumber);
      if (index !== -1) {
        orders.value[index].status = 'checked-in';
        // 如果传入了押金金额，更新订单的押金
        if (depositAmount !== undefined) {
          orders.value[index].deposit = depositAmount;
        }
      }

      console.log(`✅ 办理入住成功，订单号: ${orderNumber}`, result);
      return result;
    } catch (err) {
      console.error(`❌ 办理入住失败，订单号: ${orderNumber}`, err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message || '办理入住失败';
      error.value = errorMessage;
      throw new Error(errorMessage);
    } finally {
      loading.value = false;
    }
  }

  async function fastCheckIn(order) {
    try {
      loading.value = true;
      error.value = null;

      // Prepare data (similar to addOrder)
      const orderData = {
        order_id: order.orderNumber?.toString(),
        guest_name: order.guestName?.toString(),
        phone: order.phone?.toString() || '',
        room_type: order.roomType?.toString(),
        room_number: order.roomNumber?.toString(),
        check_in_date: formatOrderDate(order.checkInDate),
        check_out_date: formatOrderDate(order.checkOutDate),
        status: 'checked-in', // This is the key for the new API
        payment_method: viewStore.normalizePaymentMethodForDB(typeof order.paymentMethod === 'object' ? order.paymentMethod.value?.toString() : order.paymentMethod?.toString()),
        total_price: order.roomPrice,
        deposit: parseFloat(order.deposit) || 0,
        remarks: order.remarks?.toString() || '',
        order_source: order.source?.toString() || 'front_desk',
        id_source: order.sourceNumber?.toString() || '',
        create_time: new Date().toISOString(),
      };

      // Call the new API
      const response = await orderApi.fastCheckIn(orderData);

      console.log('✅ [fastCheckIn] 后端返回数据:', response);

      // The backend returns { success, message, data: { order, bill, room } }
      const newOrderFromApi = response.data?.order || response.order;

      // Update local state
      const newOrderMapped = {
        orderNumber: newOrderFromApi.order_id,
        guestName: newOrderFromApi.guest_name,
        phone: newOrderFromApi.phone,
        roomType: newOrderFromApi.room_type,
        roomNumber: newOrderFromApi.room_number,
        checkInDate: newOrderFromApi.check_in_date,
        checkOutDate: newOrderFromApi.check_out_date,
        status: newOrderFromApi.status,
        paymentMethod: newOrderFromApi.payment_method,
        roomPrice: newOrderFromApi.total_price,
        deposit: newOrderFromApi.deposit,
        createTime: newOrderFromApi.create_time,
        remarks: newOrderFromApi.remarks,
        source: newOrderFromApi.order_source,
        sourceNumber: newOrderFromApi.id_source,
      };

      orders.value.unshift(newOrderMapped);

      return response; // Return the full { order, bills } object

    } catch (err) {
      const backend = err.response?.data;
      console.error('快速入住失败:', backend || err.message);
      const code = backend?.code;
      const msg = backend?.message || err.message;
      const combined = code ? `[${code}] ${msg}` : msg;
      error.value = combined || '快速入住失败';
      throw new Error(combined);
    } finally {
      loading.value = false;
    }
  }

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
    updateOrder,
    getOrderByNumber,
    getActiveOrderByRoomNumber,
    formatOrderDate,
    createOrder: createExtendStayOrder, // 导出续住专用函数
    refundDeposit,
    checkIn,
    fastCheckIn
  }
})
