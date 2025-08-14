import { defineStore } from "pinia";
import { ref } from "vue";
import { shiftHandoverApi } from "src/api";

export const useShiftHandoverStore = defineStore("shiftHandover", () => {
  let shiftTable_data = ref({
    现金:{
      备用金: 320,
      客房收入: 0,
      休息房收入: 0,
      租车收入: 0,
      合计: 0,
      客房退押: 0,
      休息退押: 0,
      留存款: 0,
      交接款: 0
    },
    微信:{
      备用金: 320,
      客房收入: 0,
      休息房收入: 0,
      租车收入: 0,
      合计: 0,
      客房退押: 0,
      休息退押: 0,
      留存款: 0,
      交接款: 0
    },
    微邮付:{
      备用金: 320,
      客房收入: 0,
      休息房收入: 0,
      租车收入: 0,
      合计: 0,
      客房退押: 0,
      休息退押: 0,
      留存款: 0,
      交接款: 0
    },
    其他:{
      备用金: 320,
      客房收入: 0,
      休息房收入: 0,
      租车收入: 0,
      合计: 0,
      客房退押: 0,
      休息退押: 0,
      留存款: 0,
      交接款: 0
    }
  })
  let remarks_data = ref([])
  let statistics_data = ref([])
  let special_stats_data = ref(null)

  // 获取表格数据（可选传入日期）
  const fetchShiftTable = async (date) => {
    const response = await shiftHandoverApi.getShiftTable(date ? { date } : {});
    shiftTable_data.value = response;
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
  };

  // 获取交接班特殊统计（传入日期）
  const fetchSpecialStats = async (date) => {
    const response = await shiftHandoverApi.getSpecialStats(date ? { date } : {})
    special_stats_data.value = response
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
    fetchSpecialStats
  };
});
