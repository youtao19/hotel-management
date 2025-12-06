import { computed, watch } from 'vue'
import { date } from 'quasar'
import langZhCn from 'quasar/lang/zh-CN'

export function useDateLogic(orderData) {
  const minDate = date.formatDate(new Date(), 'YYYY-MM-DD')

  // 验证完整日期格式 YYYY-MM-DD
  function isValidFullDate(str) {
    if (!str) return false
    const s = String(str).trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
    const [y, m, d] = s.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  }

  // 规范化输入日期
  function normalizeInputDate(field) {
    let v = orderData.value[field]
    if (!v) return
    v = String(v).trim().replace(/\//g, '-')
    const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (m) {
      const mm = m[2].padStart(2, '0')
      const dd = m[3].padStart(2, '0')
      v = `${m[1]}-${mm}-${dd}`
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      orderData.value[field] = v
    }
    // 自动修正离店日期
    if (field === 'checkOutDate' && isValidFullDate(orderData.value.checkInDate) && isValidFullDate(v) && v < orderData.value.checkInDate) {
      orderData.value.checkOutDate = orderData.value.checkInDate
    }
  }

  // 校验规则
  const dateRule = (val) => {
    if (!val) return '请选择日期'
    const s = String(val).trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '格式应为 YYYY-MM-DD'
    return true
  }

  const checkoutAfterCheckinRule = (val) => {
    if (!isValidFullDate(orderData.value.checkInDate) || !isValidFullDate(val)) return true
    return val >= orderData.value.checkInDate || '离店日期不能早于入住日期'
  }

  // 计算属性
  const isMultiDay = computed(() => {
    if (!isValidFullDate(orderData.value.checkInDate) || !isValidFullDate(orderData.value.checkOutDate)) return false
    const checkIn = new Date(orderData.value.checkInDate)
    const checkOut = new Date(orderData.value.checkOutDate)
    const daysDiff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    return daysDiff > 1
  })

  const isRestRoom = computed(() => orderData.value.checkInDate === orderData.value.checkOutDate)

  // 生成日期列表
  const dateList = computed(() => {
    if (!isValidFullDate(orderData.value.checkInDate) || !isValidFullDate(orderData.value.checkOutDate)) return []
    const checkIn = new Date(orderData.value.checkInDate)
    const checkOut = new Date(orderData.value.checkOutDate)
    const daysDiff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    const dates = []
    if (daysDiff === 0) {
      dates.push(date.formatDate(checkIn, 'YYYY-MM-DD')) // 休息房
      return dates
    }
    for (let i = 0; i < daysDiff; i++) {
      const currentDate = new Date(checkIn)
      currentDate.setDate(currentDate.getDate() + i)
      dates.push(date.formatDate(currentDate, 'YYYY-MM-DD'))
    }
    return dates
  })

  // Watchers
  watch(isRestRoom, (now, prev) => {
    if (now === prev) return
    if (now) {
      if (!orderData.value.remarks.includes('【休息房】')) {
        orderData.value.remarks = orderData.value.remarks ? `【休息房】${orderData.value.remarks}` : '【休息房】'
      }
      orderData.value.stayType = '休息房'
      orderData.value.isRestRoom = true
    } else {
      orderData.value.remarks = orderData.value.remarks.replace(/【休息房】/g, '').trim()
      orderData.value.stayType = '客房'
      orderData.value.isRestRoom = false
    }
  })

  return {
    minDate,
    langZhCn,
    dateRule,
    checkoutAfterCheckinRule,
    isValidFullDate,
    normalizeInputDate,
    isMultiDay,
    isRestRoom,
    dateList
  }
}
