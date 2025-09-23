import { defineStore } from "pinia";
import { ref } from "vue";
import { shiftHandoverApi } from "src/api";

export const useShiftHandoverStore = defineStore("shiftHandover", () => {
  let shiftTable_data = ref({})
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

  // 开始交接班
  const startHandover = async (handoverData) => {
    const response = await shiftHandoverApi.startHandover(handoverData)
    return response
  }

  // 获取已有交接班日期
  const fetchAvailableDates = async () => {
    const response = await shiftHandoverApi.getAvailableDates()
    return response
  }

  // 获取已有交接班日期（宽松模式）
  const fetchAvailableDatesFlexible = async () => {
    const response = await shiftHandoverApi.getAvailableDatesFlexible()
    return response
  }

  // 获取交接班表格数据（从handover表查询）
  const fetchHandoverTableData = async (date) => {
    if (!date) {
      throw new Error('日期参数是必需的')
    }
    const response = await shiftHandoverApi.getHandoverTableData({ date })
    return response
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
    startHandover,
    fetchAvailableDates,
    fetchAvailableDatesFlexible,
    fetchHandoverTableData
  };
});
