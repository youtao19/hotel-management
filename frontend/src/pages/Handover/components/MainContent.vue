<template>
  <div class="main-content">
    <div class="content-layout">
      <div class="main-area">
        <div v-if="mode === 'current'" class="step-content">
          <HandoverProcess
            @complete="handleHandoverComplete"
            @show-history="handleShowHistory"
          />
        </div>

        <div v-else class="view-record-content">
          <q-card flat bordered class="record-detail-card">
            <q-card-section>
              <div class="record-header q-mb-lg">
                <div class="row items-center justify-between">
                  <div class="col">
                    <div class="text-h5 text-primary">
                      <q-icon name="description" class="q-mr-sm" />
                      交接记录详情
                    </div>
                    <div class="text-body2 text-grey-7 q-mt-sm">
                      {{ selectedRecord?.date }} - 操作员：{{ selectedRecord?.operator || selectedRecord?.handoverPerson }}
                    </div>
                  </div>
                  <div class="col-auto">
                    <q-btn flat round icon="close" @click="closeRecordView" class="text-grey-6" />
                  </div>
                </div>
              </div>

              <div class="q-mb-lg">
                <ShiftHandoverPaymentTable :payment-data="recordViewData.paymentData" :read-only="true" />
              </div>

              <div class="q-mb-lg">
                <ShiftHandoverSpecialStats
                  :total-rooms="recordViewData.totalRooms"
                  :rest-rooms="recordViewData.restRooms"
                  :vip-cards="recordViewData.vipCards"
                  :cashier-name="recordViewData.cashierName"
                  :notes="recordViewData.notes"
                  :good-review="recordViewData.goodReview"
                  :read-only="true"
                />
              </div>

              <div class="q-mb-lg">
                <ShiftHandoverMemoList
                  :task-list="recordViewData.taskList"
                  :new-task-title="recordViewData.newTaskTitle"
                  :read-only="true"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useQuasar } from "quasar";
import HandoverProcess from "./HandoverProcess.vue";
import ShiftHandoverPaymentTable from "./ShiftHandoverPaymentTable.vue";
import ShiftHandoverSpecialStats from "./ShiftHandoverSpecialStats.vue";
import ShiftHandoverMemoList from "./ShiftHandoverMemoList.vue";
import { shiftHandoverApi } from "src/api";

const props = defineProps({
  selectedRecord: {
    type: Object,
    default: null
  }
});

const $q = useQuasar();

const mode = ref("current");

const createEmptyPaymentData = () => ({
  reserve: { 现金: 0, 微信: 0, 微邮付: 0, 其他: 0 },
  hotelIncome: { 现金: 0, 微信: 0, 微邮付: 0, 其他: 0 },
  restIncome: { 现金: 0, 微信: 0, 微邮付: 0, 其他: 0 },
  carRentIncome: { 现金: 0, 微信: 0, 微邮付: 0, 其他: 0 },
  totalIncome: { 现金: 0, 微信: 0, 微邮付: 0, 其他: 0 },
  hotelRefundDeposit: { 现金: 0, 微信: 0, 微邮付: 0, 其他: 0 },
  restRefundDeposit: { 现金: 0, 微信: 0, 微邮付: 0, 其他: 0 },
  retainedAmount: { 现金: 0, 微信: 0, 微邮付: 0, 其他: 0 },
  handoverAmount: { 现金: 0, 微信: 0, 微邮付: 0, 其他: 0 }
});

function createEmptyRecordView() {
  return {
    paymentData: createEmptyPaymentData(),
    totalRooms: 0,
    restRooms: 0,
    vipCards: 0,
    cashierName: "",
    notes: "",
    goodReview: "",
    taskList: [],
    newTaskTitle: ""
  };
}

const recordViewData = ref(createEmptyRecordView());

const handleHandoverComplete = () => {
  $q.notify({
    type: "positive",
    message: "交接班已完成",
    position: "top"
  });
};

const handleShowHistory = () => {
  $q.notify({
    type: "info",
    message: "可在左侧历史记录区域查询和查看交接记录",
    position: "top",
    timeout: 1600
  });
};

const closeRecordView = () => {
  mode.value = "current";
  recordViewData.value = createEmptyRecordView();
};

const loadHandoverRecord = async (record) => {
  if (!record?.date) return;
  try {
    const [tableRes, statsRes, memoRes] = await Promise.all([
      shiftHandoverApi.getHandoverTableData({ date: record.date }),
      shiftHandoverApi.getSpecialStats({ date: record.date }),
      shiftHandoverApi.getAdminMemos({ date: record.date })
    ]);

    const paymentData = tableRes.success ? tableRes.data : createEmptyPaymentData();
    const stats = statsRes.success ? statsRes.data : {};
    const memos = memoRes.success ? memoRes.data || [] : [];

    recordViewData.value = {
      paymentData: paymentData || createEmptyPaymentData(),
      totalRooms: stats.openCount || 0,
      restRooms: stats.restCount || 0,
      vipCards: paymentData.vipCards || 0,
      cashierName: paymentData.handoverPerson || "",
      notes: paymentData.remarks || "",
      goodReview: `邀${stats.invited || 0}得${stats.positive || 0}`,
      taskList: memos,
      newTaskTitle: ""
    };
    mode.value = "record";
  } catch (error) {
    console.error("加载交接记录失败:", error);
    $q.notify({
      type: "negative",
      message: error.message || "加载交接记录失败",
      position: "top"
    });
  }
};

watch(
  () => props.selectedRecord,
  (record) => {
    if (record) {
      loadHandoverRecord(record);
    }
  }
);
</script>

<style scoped>
.main-content {
  background: linear-gradient(135deg, #fafafa 0%, #e6e5e8 100%);
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-layout {
  display: flex;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.content-layout--confirmation .main-area {
  align-items: stretch;
  padding-top: 20px;
  padding-bottom: 20px;
}

.main-area {
  flex: 1;
  min-height: 0;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.sidebar {
  width: 180px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.progress-sidebar {
  padding: 12px;
  height: 100%;
  overflow: hidden;
}

.sidebar-header {
  text-align: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.sidebar-stepper {
  background: transparent;
  overflow: hidden;
}

.sidebar-stepper :deep(.q-stepper__step-inner) {
  padding: 8px 4px;
}

.sidebar-stepper :deep(.q-stepper__caption) {
  display: none;
}

.step-content {
  width: 100%;
  max-width: 1000px;
}

.content-layout--confirmation .step-content {
  max-width: 1180px;
  margin: 0 auto;
  max-height: 100%;
  overflow: hidden;
}

.handover-actions {
  width: 100%;
  display: flex;
  justify-content: center;
  text-align: center;
}

.handover-btn {
  padding: 20px 40px;
  font-size: 18px;
  font-weight: 600;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  min-width: 200px;
}

.initial-content {
  width: 100%;
  max-width: 1000px;
}

.welcome-header {
  text-align: center;
  padding: 20px;
}
</style>
