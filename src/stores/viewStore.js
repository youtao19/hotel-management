import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useViewStore = defineStore('view', () => {
  // 房间类型选项数组，用于类型筛选下拉框
  const roomTypeOptions = [
    { label: '所有房型', value: null },  // null值表示不筛选
    { label: '标准间', value: 'standard' },
    { label: '豪华间', value: 'deluxe' },
    { label: '套房', value: 'suite' },
    { label: '总统套房', value: 'presidential' },
    { label: '家庭房', value: 'family' }
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
    { label: '待入住', value: '待入住' },
    { label: '已入住', value: '已入住' },
    { label: '已退房', value: '已退房' },
    { label: '已取消', value: '已取消' }
  ]

  // 订单状态中英文映射
  const orderStatusMap = {
    'confirmed': '待入住',
    'reserved': '已预订',
    'checked_in': '已入住',
    'checked_out': '已退房',
    'cancelled': '已取消'
    // 添加其他可能的订单状态映射
  };

  /**
   * 获取订单状态的中文文本
   * @param {string} status - 订单状态代码 (英文)
   * @returns {string} 订单状态的中文文本
   */
  function getOrderStatusText(status) {
    return orderStatusMap[status] || status; // 如果没有映射，返回原始状态
  }

  // 支付方式选项
  const paymentMethodOptions = [
    { label: '现金', value: 'cash', icon: 'mdi-cash' },
    { label: '微信', value: 'wechat', icon: 'mdi-wechat' },
    { label: '支付宝', value: 'alipay', icon: 'mdi-alipay' },
    { label: '信用卡', value: 'card', icon: 'mdi-credit-card' }
  ]

  /**
   * 获取房型的中文名称
   * @param {string} type - 房间类型代码
   * @returns {string} 房间类型的中文名称
   */
  function getRoomTypeName(type) {
    switch (type) {
      case 'standard': return '标准间'
      case 'deluxe': return '豪华间'
      case 'suite': return '套房'
      case 'presidential': return '总统套房'
      case 'family': return '家庭房'
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
    switch (status) {
      case 'available': return 'green'
      case 'occupied': return 'red'
      case 'reserved': return 'blue'
      case 'cleaning': return 'orange'
      case 'repair': return 'grey'
      case 'maintenance': return 'grey' // 兼容旧状态
      case '待入住': return 'blue'
      case '已入住': return 'red'
      case '已退房': return 'green'
      case '已取消': return 'grey'
      default: return 'grey'
    }
  }

  /**
   * 获取支付方式名称
   * @param {string} method - 支付方式代码
   * @returns {string} 支付方式名称
   */
  function getPaymentMethodName(method) {
    const option = paymentMethodOptions.find(opt => opt.value === method)
    return option ? option.label : method
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
    getRoomTypeName,
    getStatusText,
    getStatusColor,
    getOrderStatusText,
    getPaymentMethodName,
    getPaymentMethodIcon,
    formatDate
  }
})
