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
    // 仅返回，不要覆写支付表结构，防止后续聚合时报错
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
  function recalcTotals() {
    Object.keys(shiftTable_data.value).forEach(k => {
      const p = shiftTable_data.value[k]
      p.total = (Number(p.reserveCash)||0) + (Number(p.hotelIncome)||0) + (Number(p.restIncome)||0) + (Number(p.carRentIncome)||0)
    })
  }

  // 将后端数据插入到交接表中
  async function insertDataToShiftTable(date) {
    // 重置到初始结构，避免叠加和结构被覆盖
    shiftTable_data.value = getInitialPaymentData()

    // 拿到后端数据
    const response = await fetchShiftTable(date)
    const records = response?.data?.records || {}

    for (const record of Object.values(records)) {
      const isRest = String(record.check_in_date) === String(record.check_out_date)
      const amount = Number(record.totalIncome ?? 0) || (Number(record.deposit || 0) + Number(record.room_price || 0)) || 0
      const method = record.payment_method || '其他'
      // 如果是休息房
      if (isRest){
        switch (method) {
          case '现金':
            shiftTable_data.value.cash.restIncome += amount
            break
          case '微信':
            shiftTable_data.value.wechat.restIncome += amount
            break
          case '微邮付':
            shiftTable_data.value.digital.restIncome += amount
            break
          default:
            shiftTable_data.value.other.restIncome += amount
            break
        }
        continue;
      }else{// 客房
        switch (method) {
          case '现金':
            shiftTable_data.value.cash.hotelIncome += amount
            break
          case '微信':
            shiftTable_data.value.wechat.hotelIncome += amount
            break
          case '微邮付':
            shiftTable_data.value.digital.hotelIncome += amount
            break
          case '其他':
            shiftTable_data.value.other.hotelIncome += amount
            break
          default:
            break
        }
      }
    }

    const refunds = response?.data?.refunds || []
    for (const refund of refunds) {
      const rAmount = Number(refund.change_price || refund.amount || 0)
      const rMethod = refund.pay_way || refund.payment_method || '其他'
      switch (rMethod) {
        case '现金':
          shiftTable_data.value.cash.hotelDeposit += rAmount
          break
        case '微信':
          shiftTable_data.value.wechat.hotelDeposit += rAmount
          break
        case '支付宝':
        case '微邮付':
          shiftTable_data.value.digital.hotelDeposit += rAmount
          break
        case '其他':
        default:
          shiftTable_data.value.other.hotelDeposit += rAmount
          break
      }
    }

    // 计算总计
    recalcTotals()
  }

  function updateTableData(newData) {
    shiftTable_data.value = newData;
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
    insertDataToShiftTable
  };
});
