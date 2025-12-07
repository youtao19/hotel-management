<template>
  <div class="review-management q-pa-md">
    <q-card>
      <q-card-section>
        <div class="text-h6">客户好评管理</div>
        <div class="text-subtitle2 text-grey-7">管理客户好评邀请和评价状态</div>
      </q-card-section>

      <q-card-section>
        <ReviewStatsCards :statistics="statistics" />

        <q-tabs
          v-model="activeTab"
          dense
          class="text-grey"
          active-color="primary"
          indicator-color="primary"
          align="justify"
        >
          <q-tab name="pending-invitations" label="可邀请好评" />
          <q-tab name="pending-reviews" label="待设置评价" />
          <q-tab name="all-reviews" label="所有评价" />
        </q-tabs>

        <q-separator />

        <q-tab-panels v-model="activeTab" animated>
          <q-tab-panel name="pending-invitations">
            <InvitationTable
              :rows="pendingInvitations"
              :columns="invitationColumns"
              :loading="loading"
              @invite="handleInvite"
            />
          </q-tab-panel>

          <q-tab-panel name="pending-reviews">
            <PendingReviewTable
              :rows="pendingReviews"
              :columns="reviewColumns"
              :loading="loading"
              @positive="row => handleSetReview(row, true)"
              @negative="row => handleSetReview(row, false)"
            />
          </q-tab-panel>

          <q-tab-panel name="all-reviews">
            <AllReviewsTable
              :rows="allBills"
              :columns="allReviewColumns"
              :loading="loading"
            />
          </q-tab-panel>
        </q-tab-panels>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useQuasar } from "quasar";
import { useTableConfig } from "./composables/useTableConfig";
import { useReviewData } from "./composables/useReviewData";
import { useReviewActions } from "./composables/useReviewActions";
import ReviewStatsCards from "./components/ReviewStatsCards.vue";
import InvitationTable from "./components/InvitationTable.vue";
import PendingReviewTable from "./components/PendingReviewTable.vue";
import AllReviewsTable from "./components/AllReviewsTable.vue";

const $q = useQuasar();

const { invitationColumns, reviewColumns, allReviewColumns } = useTableConfig();
const { activeTab, loading, pendingInvitations, pendingReviews, allBills, statistics, fetchData } = useReviewData();
const { inviteReview, setReviewStatus } = useReviewActions({ loading, fetchData });

async function safeFetch() {
  try {
    await fetchData();
  } catch (error) {
    console.error("获取数据失败:", error);
    $q.notify({
      type: "negative",
      message: "获取数据失败: " + (error.response?.data?.message || error.message),
      position: "top"
    });
  }
}

function handleInvite(row) {
  inviteReview(row).catch(error => {
    console.error("处理邀请操作失败:", error);
  });
}

function handleSetReview(row, isPositive) {
  setReviewStatus(row, isPositive).catch(error => {
    console.error("处理评价操作失败:", error);
  });
}

onMounted(() => {
  safeFetch();
});
</script>

<style scoped>
.review-management {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
