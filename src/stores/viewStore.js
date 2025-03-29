import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useViewStore = defineStore('view', () => {
  // 房间类型选项数组，用于类型筛选下拉框
  const roomTypeOptions = [
    { label: '所有房型', value: null },  // null值表示不筛选
    { label: '标准间', value: 'standard' },
    { label: '豪华间', value: 'deluxe' },
    { label: '套房', value: 'suite' }
  ]
 
  // 房间状态选项数组，用于状态筛选下拉框
  const statusOptions = [
    { label: '所有状态', value: null },  // null值表示不筛选
    { label: '空闲', value: 'available' },
    { label: '已入住', value: 'occupied' },
    { label: '已预订', value: 'reserved' },
    { label: '清扫中', value: 'cleaning' },
    { label: '维修中', value: 'maintenance' }
  ]

  // 订单状态选项
  const orderStatusOptions = [
    { label: '所有状态', value: null },
    { label: '待入住', value: '待入住' },
    { label: '已入住', value: '已入住' },
    { label: '已退房', value: '已退房' },
    { label: '已取消', value: '已取消' }
  ]

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
      case 'maintenance': return '维修中'
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
      case 'maintenance': return 'grey'
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

  return {
    roomTypeOptions,
    statusOptions,
    orderStatusOptions,
    paymentMethodOptions,
    getRoomTypeName,
    getStatusText,
    getStatusColor,
    getPaymentMethodName,
    getPaymentMethodIcon
  }
}) 