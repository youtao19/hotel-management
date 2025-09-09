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
    try {
      // 重置到初始结构
      const obj = getInitialPaymentData();

      // 只需要调用一次 API
      const response = await fetchShiftTable(date);
      if (!response || !response.data) {
        console.error('从后端获取交接班数据失败');
        return getInitialPaymentData(); // 返回初始值避免页面崩溃
      }

      const data = response.data;

      // 1. 直接从后端获取备用金
      if (data.reserveCash) {
        obj.cash.reserveCash = Number(data.reserveCash.cash) || 320;
        obj.wechat.reserveCash = Number(data.reserveCash.wechat) || 0;
        obj.digital.reserveCash = Number(data.reserveCash.digital) || 0;
        obj.other.reserveCash = Number(data.reserveCash.other) || 0;
      }

      // 2. 填充其他收入和支出数据
      const { hotelIncome, restIncome, carRentIncome, hotelRefund, restRefund } = data;

      if (hotelIncome) {
        obj.cash.hotelIncome = Number(hotelIncome['现金'] || 0);
        obj.wechat.hotelIncome = Number(hotelIncome['微信'] || 0);
        obj.digital.hotelIncome = Number(hotelIncome['微邮付'] || 0);
        obj.other.hotelIncome = Number(hotelIncome['其他'] || 0);
      }

      if (restIncome) {
        obj.cash.restIncome = Number(restIncome['现金'] || 0);
        obj.wechat.restIncome = Number(restIncome['微信'] || 0);
        obj.digital.restIncome = Number(restIncome['微邮付'] || 0);
        obj.other.restIncome = Number(restIncome['其他'] || 0);
      }

      if (carRentIncome) {
        obj.cash.carRentIncome = Number(carRentIncome['现金'] || 0);
        obj.wechat.carRentIncome = Number(carRentIncome['微信'] || 0);
        obj.digital.carRentIncome = Number(carRentIncome['微邮付'] || 0);
        obj.other.carRentIncome = Number(carRentIncome['其他'] || 0);
      }

      if (hotelRefund) {
        obj.cash.hotelDeposit = Number(hotelRefund['现金'] || 0);
        obj.wechat.hotelDeposit = Number(hotelRefund['微信'] || 0);
        obj.digital.hotelDeposit = Number(hotelRefund['微邮付'] || 0);
        obj.other.hotelDeposit = Number(hotelRefund['其他'] || 0);
      }

      if (restRefund) {
        obj.cash.restDeposit = Number(restRefund['现金'] || 0);
        obj.wechat.restDeposit = Number(restRefund['微信'] || 0);
        obj.digital.restDeposit = Number(restRefund['微邮付'] || 0);
        obj.other.restDeposit = Number(restRefund['其他'] || 0);
      }

      // 计算总计
      recalcTotals(obj);

      return obj;
    } catch (e) {
      console.error('处理交接班数据失败:', e);
      return getInitialPaymentData(); // 出错时返回默认值
    }
  }

  // 将后端数据插入到交接表中
  async function insertDataToShiftTable(date) {
    // 现在此函数逻辑已简化，直接调用 handleData 并更新表格
    const newData = await handleData(date);
    updateTableData(newData);
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
