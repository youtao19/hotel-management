import { ref, computed } from "vue";
import { useReviewStore } from "../../../stores/reviewStore";

// 负责状态管理与数据获取，统计计算集中在此
export function useReviewData() {
  const reviewStore = useReviewStore();

  const activeTab = ref("pending-invitations");
  const loading = ref(false);
  const pendingInvitations = ref([]);
  const pendingReviews = ref([]);
  const allBills = ref([]);

  const statistics = computed(() => {
    const allBillsArray = Array.isArray(allBills.value) ? allBills.value : [];
    const pendingInvitationsArray = Array.isArray(pendingInvitations.value) ? pendingInvitations.value : [];
    const pendingReviewsArray = Array.isArray(pendingReviews.value) ? pendingReviews.value : [];

    const invited = allBillsArray.filter(bill => bill.review_invited).length;
    const positive = allBillsArray.filter(bill => bill.positive_review === true).length;

    return {
      pendingInvitations: pendingInvitationsArray.length,
      pendingReviews: pendingReviewsArray.length,
      positiveReviews: positive,
      reviewRate: invited > 0 ? Math.round((positive / invited) * 100) : 0
    };
  });

  async function fetchData() {
    try {
      loading.value = true;
      const [pendingInvitationsData, pendingReviewsData, allReviewsData] = await Promise.all([
        reviewStore.fetchPendingInvitations(),
        reviewStore.fetchPendingReviews(),
        reviewStore.fetchAllReviews()
      ]);

      pendingInvitations.value = Array.isArray(pendingInvitationsData) ? pendingInvitationsData : [];
      pendingReviews.value = Array.isArray(pendingReviewsData) ? pendingReviewsData : [];
      allBills.value = Array.isArray(allReviewsData) ? allReviewsData : [];
    } catch (error) {
      pendingInvitations.value = [];
      pendingReviews.value = [];
      allBills.value = [];
      throw error;
    } finally {
      loading.value = false;
    }
  }

  return {
    activeTab,
    loading,
    pendingInvitations,
    pendingReviews,
    allBills,
    statistics,
    fetchData
  };
}
