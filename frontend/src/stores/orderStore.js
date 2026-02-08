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
    // 如果已有进行中的请求，直接返回该请求的结果
    if (inFlightFetchAll) {
      try { return await inFlightFetchAll } finally { }
    }
    inFlightFetchAll = (async () => {
      try {
        loading.value = true
        error.value = null
        console.log('开始获取订单数据...')

        const response = await orderApi.getAllOrders()

        const rawOrders = response?.data?.data || response?.data || (Array.isArray(response) ? response : [])
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
          stayDays: Number(order.stay_days) || 0,
          stayDates: order.stay_dates || [],
          dailyPrices: order.daily_prices || null,
          isRestRoom: Boolean(order.is_rest_room),
          remainingRoomFee: order.remaining_room_fee
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

  function normalizeOrderSource(source) {
    if (!source) return 'front_desk'
    if (typeof source === 'string') return source
    if (typeof source === 'object') {
      if (source.value != null) return source.value.toString()
      if (source.code != null) return source.code.toString()
      if (source.label != null) return source.label.toString()
    }
    return source.toString() || 'front_desk'
  }

  function normalizePaymentSplits(splits) {
    if (!Array.isArray(splits)) return []
    return splits
      .map(item => ({
        method: String(item?.method || '').trim(),
        amount: Number(item?.amount || 0)
      }))
      .filter(item => item.method && item.amount > 0)
  }


  /**
   *
   * @returns Array
   */
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


  /**
   * 更新订单中特定日期的房间号
   * @async
   * @function updateOrderDayRoom
   * @param {string} orderNumber - 要更新的订单号
   * @param {string} stayDate - 要更新房间的特定日期 (格式: YYYY-MM-DD)
   * @param {string} newRoomNumber - 要分配的新房间号
   * @returns {Promise<Object>} API调用的响应结果
   * @throws {Error} 当API调用失败或出现验证错误时抛出异常
   * @description 此函数用于更新订单中特定日期的房间分配。
   * 它调用后端API并更新本地状态以反映更改。
   * 该函数还处理加载状态和错误管理。
   */
  async function updateOrderDayRoom(orderNumber, stayDate, newRoomNumber) {
    try {
      loading.value = true
      error.value = null
      console.log(`更新订单 ${orderNumber} 日期 ${stayDate} 房间为 ${newRoomNumber}`)

      const response = await orderApi.updateOrderDayRoom(orderNumber, { stayDate, newRoomNumber })
      const updatedRow = response?.data

      // 更新本地 dailyOrders
      const index = orders.value.findIndex(o => o.orderNumber === orderNumber)
      if (index !== -1 && orders.value[index].dailyOrders) {
        const dayIndex = orders.value[index].dailyOrders.findIndex(d => d.stayDate === stayDate)
        if (dayIndex !== -1) {
          orders.value[index].dailyOrders[dayIndex].roomNumber = newRoomNumber
          if (updatedRow?.room_type) {
            orders.value[index].dailyOrders[dayIndex].roomType = updatedRow.room_type
          }
        }
      }

      return response
    } catch (err) {
      console.error('更新每日房间失败:', err.response ? err.response.data : err.message)
      error.value = err.response?.data?.message || err.message || '更新每日房间失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据订单号获取订单详情
   * @param {*} orderNumber 要查询的订单 ID
   * @param {*} forceRefresh 强制刷新数据
   * @returns {Object|null} 格式化后的订单对象（与 fetchAllOrders 格式一致）
   */
  async function getOrderByNumber(orderNumber) {
    try {
      loading.value = true
      const response = await orderApi.getOrderById(orderNumber)
      // 后端返回 { data: [...rows] }，是订单每日记录数组
      const rows = response?.data?.data || response?.data
      console.log(`获取订单 ${orderNumber} 详情:`, rows)

      // 如果没有数据，返回 null
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return null
      }

      // 取第一条记录作为主订单信息（共享字段如 guest_name, status 等）
      const firstRow = rows[0]
      const dailyPrices = Object.fromEntries(
        rows.map(row => [formatOrderDate(row.stay_date), Number(row.total_price) || 0])
      )

      // 将后端蛇形命名映射为前端驼峰命名，与 fetchAllOrders 保持一致
      return {
        orderNumber: firstRow.order_id,
        guestName: firstRow.guest_name,
        phone: firstRow.phone,
        idNumber: firstRow.id_number,
        roomType: firstRow.room_type,
        roomNumber: firstRow.room_number,
        checkInDate: formatOrderDate(firstRow.check_in_date),
        checkOutDate: formatOrderDate(firstRow.check_out_date),
        status: firstRow.status,
        paymentMethod: firstRow.payment_method,
        roomPrice: firstRow.total_price,
        deposit: firstRow.deposit,
        refundedDeposit: firstRow.refunded_deposit || 0,
        refundRecords: [],
        createTime: firstRow.create_time,
        remarks: firstRow.remarks,
        source: firstRow.order_source,
        sourceNumber: firstRow.id_source,
        isPrepaid: Boolean(firstRow.is_prepaid),
        prepaidAmount: parseFloat(firstRow.prepaid_amount) || 0,
        stayDays: rows.length,
        stayDates: rows.map(row => formatOrderDate(row.stay_date)),
        dailyPrices,
        isRestRoom: firstRow.stay_type === '休息房',
        // 每日房间安排（多日订单场景），包含每日房价
        dailyOrders: rows.map(row => ({
          stayDate: formatOrderDate(row.stay_date),
          roomNumber: row.room_number,
          roomType: row.room_type,
          roomPrice: Number(row.total_price) || 0
        }))
      }
    } catch (err) {
      console.error(`获取订单 ${orderNumber} 失败:`, err)
      throw err
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

  // 办理入住
  async function checkIn(orderNumber, checkInPayload = {}) {
    try {
      loading.value = true;
      error.value = null;
      const payload = (checkInPayload && typeof checkInPayload === 'object' && !Array.isArray(checkInPayload))
        ? { ...checkInPayload }
        : { deposit: checkInPayload };
      const depositAmount = payload.deposit;
      console.log(`🚀 开始办理入住，订单号: ${orderNumber}, 押金: ${depositAmount}`);

      const checkInData = {
        ...(depositAmount !== undefined ? { deposit: depositAmount } : {}),
        ...(Array.isArray(payload.roomFeePaymentSplits) && payload.roomFeePaymentSplits.length
          ? { roomFeePaymentSplits: normalizePaymentSplits(payload.roomFeePaymentSplits) }
          : {}),
        ...(Array.isArray(payload.depositPaymentSplits) && payload.depositPaymentSplits.length
          ? { depositPaymentSplits: normalizePaymentSplits(payload.depositPaymentSplits) }
          : {})
      };
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
        orderId: order.orderNumber?.toString(),
        guestName: order.guestName?.toString(),
        phone: order.phone?.toString() || '',
        roomType: order.roomType?.toString(),
        roomNumber: order.roomNumber?.toString(),
        checkInDate: formatOrderDate(order.checkInDate),
        checkOutDate: formatOrderDate(order.checkOutDate),
        status: 'checked-in', // This is the key for the new API
        paymentMethod: viewStore.normalizePaymentMethodForDB(typeof order.paymentMethod === 'object' ? order.paymentMethod.value?.toString() : order.paymentMethod?.toString()),
        roomPrice: order.roomPrice,
        deposit: parseFloat(order.deposit) || 0,
        roomFeePaymentSplits: normalizePaymentSplits(order.roomFeePaymentSplits),
        depositPaymentSplits: normalizePaymentSplits(order.depositPaymentSplits),
        remarks: order.remarks?.toString() || '',
        orderSource: normalizeOrderSource(order.source),
        idSource: order.sourceNumber?.toString() || '',
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

  async function earlyCheckout(orderNumber, payload) {
    if (!orderNumber) {
      throw new Error('订单号无效，无法提前退房');
    }
    try {
      loading.value = true;
      error.value = null;
      const response = await orderApi.earlyCheckout(orderNumber, payload);
      const result = response?.data || response;
      const updatedOrderFromApi = result?.order || result?.data?.order;
      if (!updatedOrderFromApi) {
        throw new Error('提前退房成功，但未返回订单信息');
      }
      const index = orders.value.findIndex(o => o.orderNumber === orderNumber);
      const mappedOrder = {
        orderNumber: updatedOrderFromApi.order_id,
        guestName: updatedOrderFromApi.guest_name,
        phone: updatedOrderFromApi.phone,
        roomType: updatedOrderFromApi.room_type,
        roomNumber: updatedOrderFromApi.room_number,
        checkInDate: updatedOrderFromApi.check_in_date ? formatOrderDate(updatedOrderFromApi.check_in_date) : null,
        checkOutDate: updatedOrderFromApi.check_out_date ? formatOrderDate(updatedOrderFromApi.check_out_date) : null,
        status: updatedOrderFromApi.status,
        paymentMethod: updatedOrderFromApi.payment_method,
        roomPrice: updatedOrderFromApi.total_price,
        deposit: updatedOrderFromApi.deposit,
        refundedDeposit: updatedOrderFromApi.refunded_deposit || 0,
        refundRecords: [],
        createTime: updatedOrderFromApi.create_time,
        remarks: updatedOrderFromApi.remarks,
        source: updatedOrderFromApi.order_source,
        sourceNumber: updatedOrderFromApi.id_source,
        isPrepaid: Boolean(updatedOrderFromApi.is_prepaid),
        prepaidAmount: parseFloat(updatedOrderFromApi.prepaid_amount) || 0,
        prepaidAt: updatedOrderFromApi.prepaid_at
      };
      if (index !== -1) {
        orders.value[index] = { ...orders.value[index], ...mappedOrder };
      }
      return result;
    } catch (err) {
      console.error('提前退房失败:', err.response?.data || err.message);
      error.value = err.response?.data?.message || err.message || '提前退房失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    orders,
    loading,
    error,
    getAllOrdersLocal,
    fetchAllOrders,
    updateOrderStatusLocally,
    updateOrderStatusViaApi,
    updateOrderCheckOutLocally,
    updateOrderRoom,
    updateOrderDayRoom,
    updateOrder,
    getOrderByNumber,
    getActiveOrderByRoomNumber,
    formatOrderDate,
    createOrder: createExtendStayOrder, // 导出续住专用函数
    refundDeposit,
    checkIn,
    fastCheckIn,
    earlyCheckout
  }
})
