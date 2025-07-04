import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useViewStore = defineStore('view', () => {
  // 房间类型选项数组，用于类型筛选下拉框
  const roomTypeOptions = [
    { label: '所有房型', value: null },  // null值表示不筛选
    { label: '阿苏晚筑', value: 'asu_wan_zhu' },
    { label: '阿苏晓筑', value: 'asu_xiao_zhu' },
    { label: '行云阁有个院子', value: 'xing_yun_ge' },
    { label: '声声慢投影大床', value: 'sheng_sheng_man' },
    { label: '忆江南大床房', value: 'yi_jiang_nan' },
    { label: '云居云端影音房', value: 'yun_ju_ying_yin' },
    { label: '泊野双床', value: 'bo_ye_shuang' },
    { label: '暖居家庭房', value: 'nuan_ju_jiating' },
    { label: '醉山塘', value: 'zui_shan_tang' },
    { label: '休息房', value: 'rest' }  // 保留休息房
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
    { label: '现金', value: 'cash', icon: 'mdi-cash' },
    { label: '微信', value: 'wechat', icon: 'mdi-wechat' },
    { label: '支付宝', value: 'alipay', icon: 'mdi-alipay' },
    { label: '信用卡', value: 'card', icon: 'mdi-credit-card' }
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
      case 'asu_wan_zhu': return '阿苏晚筑'
      case 'asu_xiao_zhu': return '阿苏晓筑'
      case 'xing_yun_ge': return '行云阁有个院子'
      case 'sheng_sheng_man': return '声声慢投影大床'
      case 'yi_jiang_nan': return '忆江南大床房'
      case 'yun_ju_ying_yin': return '云居云端影音房'
      case 'bo_ye_shuang': return '泊野双床'
      case 'nuan_ju_jiating': return '暖居家庭房'
      case 'zui_shan_tang': return '醉山塘'
      case 'rest': return '休息房'  // 保留休息房
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
    roomTypeMap,
    updateRoomTypeMap,
    getRoomTypeName,
    getStatusText,
    getStatusColor,
    getOrderStatusText,
    getPaymentMethodName,
    getPaymentMethodIcon,
    formatDate
  }
})
