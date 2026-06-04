import { ref } from "vue";
import { useQuasar } from "quasar";
import { shiftHandoverApi } from "src/api";

export function useHandoverSubmit({ handoverInfo, selectedHandoverDate, retainedAmount, vipCards }) {
  const $q = useQuasar();
  const submitting = ref(false);

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
      const payload = {
        date: selectedHandoverDate.value,
        receivePerson: handoverInfo.value.nextOperator,
        retainedAmount: retainedAmount.value,
        vipCard: Number(vipCards.value) || 0,
        notes: handoverInfo.value.notes || ""
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
