import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useViewStore = defineStore('view', () => {
  // 房间类型选项数组，用于类型筛选下拉框
  const roomTypeOptions = [
    { label: '所有房型', value: null },  // null值表示不筛选
    { label: '阿苏晓筑', value: 'asu_xiao_zhu' },
    { label: '行云阁', value: 'xing_yun_ge' },
    { label: '有个院子', value: 'you_ge_yuan_zi' },
    { label: '声声慢投影大床', value: 'sheng_sheng_man' },
    { label: '忆江南大床房', value: 'yi_jiang_nan' },
    { label: '云居云端影音房', value: 'yun_ju_ying_yin' },
    { label: '泊野双床', value: 'bo_ye_shuang' },
    { label: '暖居家庭房', value: 'nuan_ju_jiating' },
    { label: '醉山塘', value: 'zui_shan_tang' },
  ]

  // 房间状态选项数组，用于状态筛选下拉框
  const statusOptions = [
    { label: '所有状态', value: null },  // null值表示不筛选
    { label: '空闲', value: 'available' },
    { label: '已入住', value: 'occupied' },
    { label: '已预订', value: 'reserved' },
    { label: '清扫中', value: 'cleaning' },
    { label: '维修中', value: 'repair' }
  ]

  // 订单状态选项
  const orderStatusOptions = [
    { label: '所有状态', value: null },
    { label: '待入住', value: 'pending' },
    { label: '已入住', value: 'checked-in' },
    { label: '已退房', value: 'checked-out' },
    { label: '已取消', value: 'cancelled' }
  ]

  // 订单状态颜色映射
  const ORDER_STATUS_COLORS = {
    'pending': 'blue',      // 待入住
    'checked-in': 'green',  // 已入住
    'checked-out': 'grey',  // 已退房
    'cancelled': 'red'      // 已取消
  };

  // 订单状态文本映射
  const ORDER_STATUS_TEXT = {
    'pending': '待入住',
    'checked-in': '已入住',
    'checked-out': '已退房',
    'cancelled': '已取消'
  };

  /**
   * 获取订单状态的中文文本
   * @param {string} status - 订单状态代码 (英文)
   * @returns {string} 订单状态的中文文本
   */
  function getOrderStatusText(status) {
    return ORDER_STATUS_TEXT[status] || status;
  }

  // 支付方式选项
  const paymentMethodOptions = [
    { label: '微邮付', value: '微邮付', icon: 'mdi-alipay' },
    { label: '微信', value: '微信', icon: 'mdi-wechat' },
    { label: '现金', value: '现金', icon: 'mdi-cash' },
    { label: '平台', value: '平台', icon: 'mdi-cash' }
  ]

  /**
   * 获取支付方式名称
   * @param {string} method - 支付方式代码或中文名称
   * @returns {string} 支付方式名称
   */
  function getPaymentMethodName(method) {
    // 如果输入的是英文值，返回对应的中文标签
    const option = paymentMethodOptions.find(opt => opt.value === method)
    if (option) {
      return option.label
    }

    // 如果输入的是中文标签，直接返回
    const labelOption = paymentMethodOptions.find(opt => opt.label === method)
    if (labelOption) {
      return labelOption.label
    }

    // 处理其他常见的支付方式
    const commonMethods = {
      '支付宝': '支付宝',
      'alipay': '支付宝',
      '银行卡': '银行卡',
      'card': '银行卡',
      'bank_card': '银行卡',
      'credit_card': '银行卡'
    }

    if (commonMethods[method]) {
      return commonMethods[method]
    }

    return method
  }

  /**
   * 获取支付方式的值（英文）
   * @param {string} methodLabel - 支付方式的中文标签
   * @returns {string} 支付方式的英文值
   */
  function getPaymentMethodValue(methodLabel) {
    const option = paymentMethodOptions.find(opt => opt.label === methodLabel)
    if (option) {
      return option.value
    }

    // 处理其他常见的支付方式
    const commonMethods = {
      '支付宝': 'alipay',
      '银行卡': 'card',
      '信用卡': 'card'
    }

    if (commonMethods[methodLabel]) {
      return commonMethods[methodLabel]
    }

    return methodLabel.toLowerCase()
  }

  /**
   * 将支付方式值转换为数据库期望的中文格式
   * @param {string} method - 支付方式代码或标签
   * @returns {string} 数据库期望的中文支付方式
   */
  function normalizePaymentMethodForDB(method) {
    if (!method) return '现金'

    // 支付方式映射表 - 统一转换为数据库期望的中文格式
    const methodMap = {
      // 英文值到中文
      'cash': '现金',
      'wechat': '微信',
      'weiyoufu': '微邮付',
      'alipay': '支付宝',
      'card': '银行卡',
      'bank_card': '银行卡',
      'credit_card': '银行卡',
      'platform': '平台',

      // 中文标签保持不变
      '现金': '现金',
      '微信': '微信',
  '微邮付': '微邮付', // 修正: 微邮付保持自身映射
      '支付宝': '支付宝',
      '银行卡': '银行卡',
      '信用卡': '银行卡',
      '平台': '平台'
    }

    return methodMap[method] || '现金'
  }

  // 退押金状态选项
  const depositRefundStatusOptions = [
    { label: '未退押金', value: 'not_refunded' },
    { label: '部分退押金', value: 'partially_refunded' },
    { label: '已全部退押金', value: 'fully_refunded' }
  ]

    // 房型数据映射（用于动态获取房型名称）
  const roomTypeMap = ref(new Map())

  /**
   * 更新房型映射数据
   * @param {Array} roomTypesData - 房型数据数组
   */
  function updateRoomTypeMap(roomTypesData) {
    roomTypeMap.value.clear()
    if (Array.isArray(roomTypesData)) {
      roomTypesData.forEach(roomType => {
        if (roomType.type_code && roomType.type_name) {
          roomTypeMap.value.set(roomType.type_code, roomType.type_name)
        }
      })
    }
  }

  /**
   * 获取房型的中文名称
   * @param {string} type - 房间类型代码
   * @returns {string} 房间类型的中文名称
   */
  function getRoomTypeName(type) {
    if (!type) return ''

    // 优先从数据库房型映射中获取
    if (roomTypeMap.value.has(type)) {
      return roomTypeMap.value.get(type)
    }

    // 如果无法从数据库获取，使用硬编码映射作为备用
    switch (type) {
      case 'asu_xiao_zhu': return '阿苏晓筑'
      case 'xing_yun_ge': return '行云阁'
      case 'you_ge_yuan_zi': return '有个院子'
      case 'sheng_sheng_man': return '声声慢投影大床'
      case 'yi_jiang_nan': return '忆江南大床房'
      case 'yun_ju_ying_yin': return '云居云端影音房'
      case 'bo_ye_shuang': return '泊野双床'
      case 'nuan_ju_jiating': return '暖居家庭房'
      case 'zui_shan_tang': return '醉山塘'
      default: return type
    }
  }

  /**
   * 获取状态的中文文本
   * @param {string} status - 房间状态代码
   * @returns {string} 房间状态的中文文本
   */
  function getStatusText(status) {
    switch (status) {
      case 'available': return '空闲'
      case 'occupied': return '已入住'
      case 'reserved': return '已预订'
      case 'cleaning': return '清扫中'
      case 'repair': return '维修中'
      case 'maintenance': return '维修中' // 兼容旧状态
      default: return status
    }
  }

  /**
   * 获取状态的颜色
   * @param {string} status - 房间状态
   * @returns {string} 状态对应的颜色
   */
  function getStatusColor(status) {
    return ORDER_STATUS_COLORS[status] || 'grey';
  }

  /**
   * 获取支付方式图标
   * @param {string} method - 支付方式代码
   * @returns {string} 支付方式图标
   */
  function getPaymentMethodIcon(method) {
    const option = paymentMethodOptions.find(opt => opt.value === method)
    return option ? option.icon : 'mdi-help-circle'
  }

  /**
   * 获取押金退款状态
   * @param {Object} order - 订单对象
   * @returns {string} 押金退款状态
   */
  function getDepositRefundStatus(order) {
    if (!order || (order.deposit || 0) <= 0) {
      return 'not_applicable' // 无押金
    }

    const originalDeposit = order.deposit || 0
    const refundedDeposit = order.refundedDeposit || 0

    if (refundedDeposit <= 0) {
      return 'not_refunded'
    } else if (refundedDeposit >= originalDeposit) {
      return 'fully_refunded'
    } else {
      return 'partially_refunded'
    }
  }

  /**
   * 格式化日期时间显示
   * @param {string} dateString - 日期时间字符串，如 ISO 格式
   * @param {boolean} includeTime - 是否包含时间部分
   * @returns {string} 格式化后的日期时间字符串 (YYYY-MM-DD 或 YYYY-MM-DD HH:MM)
   */
  function formatDate(dateString, includeTime = false) {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);

      // 如果日期无效，直接返回原始字符串
      if (isNaN(date.getTime())) {
        return dateString;
      }

      // 获取年月日
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      // 基本日期格式
      let formattedDate = `${year}-${month}-${day}`;

      // 如果需要显示时间
      if (includeTime) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        formattedDate += ` ${hours}:${minutes}`;
      }

      return formattedDate;
    } catch (err) {
      console.error('日期格式化错误:', err);
      return dateString;
    }
  }

  return {
    roomTypeOptions,
    statusOptions,
    orderStatusOptions,
    paymentMethodOptions,
    depositRefundStatusOptions,
    roomTypeMap,
    updateRoomTypeMap,
    getRoomTypeName,
    getStatusText,
    getStatusColor,
    getOrderStatusText,
    getPaymentMethodName,
    getPaymentMethodIcon,
    getDepositRefundStatus,
    formatDate,
    getPaymentMethodValue,
    normalizePaymentMethodForDB
  }
})
