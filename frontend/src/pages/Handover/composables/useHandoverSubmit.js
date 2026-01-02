import { ref } from "vue";
import { useQuasar } from "quasar";
import { shiftHandoverApi } from "src/api";
import { useUserStore } from "src/stores/userStore";

export function useHandoverSubmit({ confirmationData, handoverInfo, selectedHandoverDate }) {
  const $q = useQuasar();
  const userStore = useUserStore();
  const submitting = ref(false);

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const resolveBusinessDate = () => {
    if (selectedHandoverDate?.value) return selectedHandoverDate.value;
    const now = new Date();
    const currentHour = now.getHours();
    const businessDate = new Date(now);
    if (currentHour < 8) {
      businessDate.setDate(businessDate.getDate() - 1);
    }
    businessDate.setDate(businessDate.getDate() - 1);
    return formatLocalDate(businessDate);
  };

  const completeHandover = async () => {
    if (!handoverInfo.value.nextOperator) {
      $q.notify({
        type: "warning",
        message: "请输入接班人员姓名",
        position: "top"
      });
      return;
    }

    try {
      submitting.value = true;
      const date = resolveBusinessDate();
      const pd = confirmationData.value?.paymentData || {};
      const payload = {
        date,
        handoverPerson: userStore.user?.username || "当前操作员",
        receivePerson: handoverInfo.value.nextOperator,
        paymentData: {
          reserve: pd.reserve,
          hotelIncome: pd.hotelIncome,
          restIncome: pd.restIncome,
          carRentIncome: pd.carRentIncome,
          totalIncome: pd.totalIncome,
          // 后端字段名为 deposit
          hotelDeposit: pd.hotelRefundDeposit,
          restDeposit: pd.restRefundDeposit,
          totalRefundDeposit: pd.totalRefundDeposit,
          retainedAmount: pd.retainedAmount,
          handoverAmount: pd.handoverAmount
        },
        vipCard: confirmationData.value.vipCards || 0,
        taskList: confirmationData.value.taskList || [],
        notes: handoverInfo.value.notes || "",
        handoverTime: handoverInfo.value.handoverTime || undefined
      };

      const response = await shiftHandoverApi.completeHandover(payload);
      if (!response.success) {
        throw new Error(response.message || "保存失败");
      }

      $q.notify({
        type: "positive",
        message: "交接班数据已保存",
        position: "top"
      });
      return true;
    } catch (error) {
      console.error("完成交接失败:", error);
      $q.notify({
        type: "negative",
        message: error.message || "完成交接失败，请重试",
        position: "top"
      });
      return false;
    } finally {
      submitting.value = false;
    }
  };

  return {
    submitting,
    completeHandover
  };
}
