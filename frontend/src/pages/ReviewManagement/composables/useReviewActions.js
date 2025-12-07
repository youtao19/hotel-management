import { useQuasar } from "quasar";
import { useReviewStore } from "../../../stores/reviewStore";

// 处理用户动作及其反馈，成功后触发数据刷新
export function useReviewActions({ loading, fetchData }) {
  const $q = useQuasar();
  const reviewStore = useReviewStore();

  async function inviteReview(bill) {
    try {
      loading.value = true;
      await reviewStore.inviteReview(bill.order_id);

      $q.notify({
        type: "positive",
        message: `已成功邀请客户 ${bill.guest_name} 参与好评`,
        position: "top"
      });

      await fetchData();
    } catch (error) {
      console.error("邀请好评失败:", error);
      $q.notify({
        type: "negative",
        message: "邀请好评失败: " + (error.response?.data?.message || error.message),
        position: "top"
      });
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function setReviewStatus(bill, isPositive) {
    try {
      loading.value = true;
      await reviewStore.updateReviewStatus(bill.order_id, isPositive);

      $q.notify({
        type: "positive",
        message: `已将客户 ${bill.guest_name} 的评价设置为${isPositive ? "好评" : "未好评"}`,
        position: "top"
      });

      await fetchData();
    } catch (error) {
      console.error("设置评价状态失败:", error);
      $q.notify({
        type: "negative",
        message: "设置评价状态失败: " + (error.response?.data?.message || error.message),
        position: "top"
      });
      throw error;
    } finally {
      loading.value = false;
    }
  }

  return {
    inviteReview,
    setReviewStatus
  };
}
