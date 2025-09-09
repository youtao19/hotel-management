import { defineStore } from "pinia";
import { ref } from "vue";
import { shiftHandoverApi } from "src/api";

export const useShiftHandoverStore = defineStore("shiftHandover", () => {

  let shiftTable_data = ref({
  cash: {
    reserveCash: 320,
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 320
  },
  wechat: {
    reserveCash: 0,
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  },
  digital: {
    reserveCash: 0,
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  },
  other: {
    reserveCash: 0,
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  }
})
  let remarks_data = ref([])
  let statistics_data = ref([])
  let special_stats_data = ref(null)

  // 获取表格数据（可选传入日期）
  const fetchShiftTable = async (date) => {
    const response = await shiftHandoverApi.getShiftTable(date ? { date } : {});
    return response;
  };

  // 获取备忘录数据（可选传入日期）
  const fetchRemarks = async (date) => {
    const response = await shiftHandoverApi.getRemarks(date ? { date } : {});
    remarks_data.value = response;
    return response;
  };

  // 获取统计信息
  const fetchStatistics = async () => {
    const response = await shiftHandoverApi.getStatistics();
    statistics_data.value = response;
    return response;
  };

  // 获取交接班特殊统计（传入日期）
  const fetchSpecialStats = async (date) => {
    const response = await shiftHandoverApi.getSpecialStats(date ? { date } : {})
    special_stats_data.value = response
    return response
  }

  // 获取初始支付数据结构
  function getInitialPaymentData() {
    return {
      cash: {
        reserveCash: 320,
        hotelIncome: 0,
        restIncome: 0,
        carRentIncome: 0,
        total: 0,
        hotelDeposit: 0,
        restDeposit: 0,
        retainedAmount: 320
      },
      wechat: {
        reserveCash: 0,
        hotelIncome: 0,
        restIncome: 0,
        carRentIncome: 0,
        total: 0,
        hotelDeposit: 0,
        restDeposit: 0,
        retainedAmount: 0
      },
      digital: {
        reserveCash: 0,
        hotelIncome: 0,
        restIncome: 0,
        carRentIncome: 0,
        total: 0,
        hotelDeposit: 0,
        restDeposit: 0,
        retainedAmount: 0
      },
      other: {
        reserveCash: 0,
        hotelIncome: 0,
        restIncome: 0,
        carRentIncome: 0,
        total: 0,
        hotelDeposit: 0,
        restDeposit: 0,
        retainedAmount: 0
      }
    }
  }

  // 重新计算各项合计
  function recalcTotals(target = shiftTable_data.value) {
    Object.keys(target).forEach(k => {
      const p = target[k]
      p.total = (Number(p.reserveCash)||0) + (Number(p.hotelIncome)||0) + (Number(p.restIncome)||0) + (Number(p.carRentIncome)||0)
    })
  }

  // 处理选中日期的数据
  async function handleData(date) {
    try{
      // 重置到初始结构，避免叠加和结构被覆盖
    const obj = getInitialPaymentData()

    // 从后端拿备用金
    let reserveFromDb = await shiftHandoverApi.getReserveCash(date)
    console.log('获取到的备用金:', reserveFromDb)
    if (reserveFromDb?.success && reserveFromDb.data) {
      obj.cash.reserveCash = Number(reserveFromDb.data.cash) || 320
      obj.wechat.reserveCash = Number(reserveFromDb.data.wechat) || 0
      obj.digital.reserveCash = Number(reserveFromDb.data.digital) || 0
      obj.other.reserveCash = Number(reserveFromDb.data.other) || 0
    } else {
      console.log('未获取到当日备用金，尝试获取前一日交接款')
      const prevHandover = await fetchPreviousHandover(date)
      if (prevHandover) {
        const prevCash = Number(prevHandover.cash)
        // 仅当昨日交接款为正数时覆盖默认值；否则保留初始化的 320
        if (!isNaN(prevCash) && prevCash > 0) {
          obj.cash.reserveCash = prevCash
        }
        // 其它方式备用金默认仍为 0，若未来有多支付方式备用金可在此扩展
      }
    }

    // 拿到后端数据
    const response = await fetchShiftTable(date)
    const records = response?.data?.records || {}

    for (const record of Object.values(records)) {
      // 使用 stay_type 字段判断业务类型，而不是日期比较
      const isRest = record.stay_type === '休息房'
      const amount = Number(record.totalIncome ?? 0) || (Number(record.deposit || 0) + Number(record.room_price || 0)) || 0
      const method = record.payment_method || '其他'

      // 如果是休息房
      if (isRest){
        switch (method) {
          case '现金':
            obj.cash.restIncome += amount
            break
          case '微信':
            obj.wechat.restIncome += amount
            break
          case '微邮付':
            obj.digital.restIncome += amount
            break
          case '其他':
            obj.other.restIncome += amount
            break
          default:
            break
        }
        continue;
      }else{// 客房
        switch (method) {
          case '现金':
            obj.cash.hotelIncome += amount
            break
          case '微信':
            obj.wechat.hotelIncome += amount
            break
          case '微邮付':
            obj.digital.hotelIncome += amount
            break
          case '其他':
            obj.other.hotelIncome += amount
            break
          default:
            break
        }
      }
    }

    const refunds = response?.data?.refunds || []
    for (const refund of refunds) {
      const rAmount = Math.abs(Number(refund.change_price || refund.amount || 0)) // 取绝对值，因为退押金通常是负数
      const rMethod = refund.pay_way || refund.payment_method || '其他'
      const rStayType = refund.stay_type || '客房' // 默认为客房

      // 根据住宿类型和支付方式分类退押金
      if (rStayType === '休息房') {
        // 休息房退押金
        switch (rMethod) {
          case '现金':
            obj.cash.restDeposit += rAmount
            break
          case '微信':
            obj.wechat.restDeposit += rAmount
            break
          case '微邮付':
            obj.digital.restDeposit += rAmount
            break
          case '其他':
            obj.other.restDeposit += rAmount
            break
          default:
            break
        }
      } else {
        // 客房退押金
        switch (rMethod) {
          case '现金':
            obj.cash.hotelDeposit += rAmount
            break
          case '微信':
            obj.wechat.hotelDeposit += rAmount
            break
          case '微邮付':
            obj.digital.hotelDeposit += rAmount
            break
          case '其他':
            obj.other.hotelDeposit += rAmount
            break
          default:
            break
        }
      }
    }

    // 其他收入，放在租车收入

    const otherIncomes = response?.data?.otherIncomeTotal || {}
    obj.cash.carRentIncome += Math.abs(Number(otherIncomes['现金'] || 0))
    obj.wechat.carRentIncome += Math.abs(Number(otherIncomes['微信'] || 0))
    obj.digital.carRentIncome += Math.abs(Number(otherIncomes['微邮付'] || 0))
    obj.other.carRentIncome += Math.abs(Number(otherIncomes['其他'] || 0))

    // 计算总计（针对临时对象）
    recalcTotals(obj)

    return obj;
    } catch(e){
      console.error('处理交接班数据失败:', e)
    }

  }

  // 将后端数据插入到交接表中
  async function insertDataToShiftTable(date) {
    // 优先获取数据库已保存备用金
    let reserveFromDb = null
    try {
      const dbRes = await shiftHandoverApi.getReserveCash(date)
      const data = dbRes?.data || dbRes
      if (data && typeof data === 'object') {
        reserveFromDb = {
          cash: Number(data.cash)||0,
          wechat: Number(data.wechat)||0,
          digital: Number(data.digital)||0,
          other: Number(data.other)||0
        }
      }
    } catch (e) {
      console.warn('获取数据库备用金失败，使用昨日交接款回退:', e?.message || e)
    }

    // 回退：获取昨日交接款
    const prev = reserveFromDb || await fetchPreviousHandover(date)

    // 处理并更新数据（把备用金作为今日 reserveCash）
    const newData = await handleData(date, prev)
    updateTableData(newData)
  }

  function updateTableData(newData) {
    shiftTable_data.value = newData;
  }

  // 获取昨日交接款 = (reserveCash + 收入合计 - 退押金合计 - retainedAmount)
  async function fetchPreviousHandover(date) {
    try {
      const current = new Date(date)
      const prev = new Date(current.getTime() - 24 * 60 * 60 * 1000)
      const prevDate = prev.toISOString().split('T')[0]
      const prevData = await handleData(prevDate)
      const result = {}
      // 计算昨日交接款
      for (const k of Object.keys(prevData)) {
        const row = prevData[k]
        const deposits = (Number(row.hotelDeposit)||0) + (Number(row.restDeposit)||0)
        const handover = (Number(row.total)||0) - deposits - (Number(row.retainedAmount)||0)
        result[k] = handover
      }
      result.cash = prevData.cash.retainedAmount

      return result
    } catch (e) {
      console.error('获取昨日交接款失败:', e)
      return { cash:0, wechat:0, digital:0, other:0 }
    }
  }

  return {
    shiftTable_data,
    fetchShiftTable,
    remarks_data,
    fetchRemarks,
    statistics_data,
    fetchStatistics,
    special_stats_data,
    fetchSpecialStats,
    updateTableData,
    insertDataToShiftTable,
    fetchPreviousHandover
  };
});
