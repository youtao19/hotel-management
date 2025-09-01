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
      // 使用带宽限缓存的接口，减少频繁全量查询带来的抖动
      const response = await orderApi.getAllOrdersWithGrace()
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
  // refundRecords / refundedDeposit 改为由账单层获取，这里先占位0与空数组（调用端如需精确数据应查询账单）
  refundRecords: [],
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
  // 失败时不清空现有列表，保留旧数据以提升可用性
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
      // 保留 YYYY-MM-DD 原样，避免 toISOString 造成时区回退一天（东八区等）
      const strictDateRegex = /^\d{4}-\d{2}-\d{2}$/; // 最终必须匹配的严格格式

      // 允许的输入格式: YYYY-MM-DD / YYYY/MM/DD / YYYY-M-D / YYYY/M/D
      function normalizeDateInput(input) {
        if (!input) return null;
        if (input instanceof Date) {
          const y = input.getFullYear();
          const m = String(input.getMonth() + 1).padStart(2, '0');
          const d = String(input.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        let s = String(input).trim();
        // 替换斜杠为短横线
        if (s.includes('/')) s = s.replaceAll('/', '-');
        // 匹配宽松格式 YYYY-M-D
        const loose = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
        const m = s.match(loose);
        if (m) {
          const year = m[1];
          const month = m[2].padStart(2, '0');
          const day = m[3].padStart(2, '0');
          const normalized = `${year}-${month}-${day}`;
          return normalized;
        }
        return s; // 其他情况原样返回供后续严格校验
      }

      function assertValidDate(str, label) {
        if (!strictDateRegex.test(str)) {
          console.error(`${label}格式错误:`, str);
          throw new Error(`${label}格式错误`);
        }
        // 进一步校验真实日期有效性（如 2025-02-30）
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
        room_price: order.roomPrice,     // 支持数字或JSON格式的价格数据
        deposit: parseFloat(order.deposit) || 0,          // 确保是数字
        remarks: order.remarks?.toString() || '',
        order_source: order.source?.toString() || 'front_desk',  // 从 source 映射，确保是字符串
        id_source: order.sourceNumber?.toString() || '',   // 从 sourceNumber 映射，确保是字符串
        create_time: new Date().toISOString(),            // 使用当前时间
      }


      // 验证必填字段
      const requiredFields = ['order_id', 'guest_name', 'id_number', 'room_type', 'room_number', 'check_in_date', 'check_out_date', 'room_price'];

      const missingFields = requiredFields.filter(field => {
        const value = orderData[field];

        // room_price 特殊处理：可以是数字或对象
        if (field === 'room_price') {
          if (typeof value === 'number') {
            return value <= 0;
          } else if (typeof value === 'object' && value !== null) {
            // 检查是否为有效的价格对象且不为空
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
      const backend = err.response?.data;
      console.error('添加订单失败:', backend || err.message);
      const code = backend?.error?.code || backend?.error?.details || backend?.code;
      const msg = backend?.message || backend?.error?.details || backend?.error?.message || err.message;
      const combined = code ? `[${code}] ${msg}` : msg;
      error.value = combined || '添加订单失败';
      // 抛出新的 Error 便于上层显示
      throw new Error(combined);
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
      // 将 503 繁忙错误转换为更友好的提示
      const status = err.response?.status;
      if (status === 503) {
        error.value = err.response?.data?.message || '系统繁忙，请稍后重试';
      } else {
        error.value = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || '更新订单状态失败';
      }
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
      console.log('✅ 退押金处理成功:', response);

      // 成功后刷新押金状态（账单层）
      try {
        const dep = await orderApi.getDepositInfo(refundData.orderNumber);
        const orderIndex = orders.value.findIndex(order => order.orderNumber === refundData.orderNumber);
        if (orderIndex !== -1 && dep?.data) {
          orders.value[orderIndex].refundedDeposit = dep.data.refunded;
          orders.value[orderIndex].deposit = dep.data.deposit; // 防止历史为0时补齐
        }
      } catch (e) {
        console.warn('刷新押金状态失败:', e.message);
      }
      return response;

    } catch (err) {
      console.error('❌ 退押金处理失败:', err);
      const resp = err.response?.data;
      // 如果是超额报错且提供 availableRefund，自动调整本地可退显示（refundedDeposit = deposit - availableRefund）
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

  // 获取订单修改历史
  async function getOrderChangeHistory(orderNumber) {
    try {
      console.log(`获取订单 ${orderNumber} 的修改历史`);
      return await orderApi.getOrderChangeHistory(orderNumber);
    } catch (err) {
      console.error(`获取订单 ${orderNumber} 修改历史失败:`, err);
      throw err;
    }
  }

  // 更新订单信息
  async function updateOrder(orderNumber, orderData) {
    try {
      loading.value = true;
      error.value = null;

      console.log(`更新订单 ${orderNumber} 信息:`, orderData);
      const response = await orderApi.updateOrder(orderNumber, orderData);

      // 更新本地状态
      const updatedOrderFromApi = response.order || response;

      // 添加防御性检查
      if (orders.value && Array.isArray(orders.value)) {
        const index = orders.value.findIndex(o => o.orderNumber === orderNumber);

        if (index !== -1) {
          // 更新本地订单数据，包含所有可能的字段
          orders.value[index] = {
            ...orders.value[index],
            guestName: updatedOrderFromApi.guest_name || orders.value[index].guestName,
            phone: updatedOrderFromApi.phone || orders.value[index].phone,
            roomNumber: updatedOrderFromApi.room_number || orders.value[index].roomNumber,
            remarks: updatedOrderFromApi.remarks || orders.value[index].remarks,
            idNumber: updatedOrderFromApi.id_card || orders.value[index].idNumber,
            gender: updatedOrderFromApi.gender || orders.value[index].gender,
            source: updatedOrderFromApi.source || orders.value[index].source,
            checkInDate: updatedOrderFromApi.check_in_time || orders.value[index].checkInDate,
            checkOutDate: updatedOrderFromApi.check_out_time || orders.value[index].checkOutDate,
            shouldPay: updatedOrderFromApi.should_pay || orders.value[index].shouldPay,
            paidAmount: updatedOrderFromApi.paid_amount || orders.value[index].paidAmount,
            deposit: updatedOrderFromApi.deposit || orders.value[index].deposit,
            paymentMethod: updatedOrderFromApi.pay_way || orders.value[index].paymentMethod,
            roomType: updatedOrderFromApi.room_type || orders.value[index].roomType,
            status: updatedOrderFromApi.order_status || orders.value[index].status,
            discount: updatedOrderFromApi.discount || orders.value[index].discount,
            days: updatedOrderFromApi.days || orders.value[index].days,
            isCompany: updatedOrderFromApi.is_company || orders.value[index].isCompany,
            companyName: updatedOrderFromApi.company_name || orders.value[index].companyName,
            roomRate: updatedOrderFromApi.room_rate || orders.value[index].roomRate,
            arrivalTime: updatedOrderFromApi.arrival_time || orders.value[index].arrivalTime,
            stayType: updatedOrderFromApi.stay_type || orders.value[index].stayType
          };
        }
      }

      return updatedOrderFromApi;
    } catch (err) {
      console.error('更新订单信息失败:', err.response ? err.response.data : err.message);
      error.value = err.response?.data?.message || '更新订单信息失败';
      throw err;
    } finally {
      loading.value = false;
    }
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
    getOrderChangeHistory,
    updateOrder,
    updateOrderCheckOutLocally,
    updateOrderRoom,
    getOrderByNumber,
    getActiveOrderByRoomNumber,
    formatOrderDate,
    createOrder,
    refundDeposit
  }
})
