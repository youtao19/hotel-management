<template>
  <div class="main-content">
    <div class="content-layout">
      <div class="main-area">
        <div v-if="currentStep > 0" class="step-content q-mb-lg">
          <HandoverProcess
            :current-step="currentStep"
            @step-change="handleStepChange"
            @complete="handleHandoverComplete"
            @logout="handleLogout"
          />
        </div>

        <div v-else-if="currentStep === -1" class="view-record-content">
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

        <div v-else class="initial-content">
          <q-card flat bordered class="welcome-card q-mb-lg">
            <q-card-section>
              <div class="welcome-header">
                <q-icon name="swap_horiz" size="3rem" color="primary" class="q-mb-md" />
                <div class="text-h5 text-primary q-mb-sm">交接班系统</div>
                <div class="text-body1 text-grey-7">
                  欢迎使用酒店管理系统交接班功能，请在合适的时间开始交接班流程
                </div>
              </div>
            </q-card-section>
          </q-card>

          <div class="handover-actions">
            <q-btn
              color="primary"
              size="xl"
              icon="swap_horiz"
              label="开始交接班"
              class="handover-btn q-mb-md"
              :loading="isHandoverInProgress"
              @click="handleStartHandover"
            />
          </div>
        </div>
      </div>

      <div class="sidebar">
        <div class="progress-sidebar">
          <div class="sidebar-header">
            <h6 class="text-primary q-mb-sm">交接班流程</h6>
            <p class="text-caption text-grey-7">当前进度</p>
          </div>

          <q-stepper
            v-model="currentStep"
            color="primary"
            animated
            vertical
            flat
            class="sidebar-stepper"
          >
            <q-step :name="1" title="检查记录" caption="检查昨日交接记录" icon="history" />
            <q-step :name="2" title="确认备用金" caption="核实备用金金额" icon="account_balance_wallet" />
            <q-step :name="3" title="核对数据" caption="核对交接数据" icon="fact_check" />
            <q-step :name="4" title="确认数据" caption="确认交接数据" icon="verified" />
            <q-step :name="5" title="接班信息" caption="输入接班人和时间" icon="person_add" />
            <q-step :name="6" title="完成交接" caption="完成流程" icon="check_circle" />
          </q-stepper>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useQuasar } from "quasar";
import { useRouter } from "vue-router";
import { useUserStore } from "src/stores/userStore";
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
const router = useRouter();
const userStore = useUserStore();

const isHandoverInProgress = ref(false);
const currentStep = ref(0);

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

const handleStartHandover = () => {
  isHandoverInProgress.value = true;
  $q.dialog({
    title: "确认交接班",
    message:
      "确定要开始交接班流程吗？系统将引导您完成以下步骤：<br/>1. 检查昨日交接记录<br/>2. 确认备用金<br/>3. 核对交接数据<br/>4. 确认交接数据<br/>5. 输入接班信息<br/>6. 完成交接",
    cancel: true,
    persistent: true,
    html: true
  })
    .onOk(() => {
      currentStep.value = 1;
    })
    .onDismiss(() => {
      isHandoverInProgress.value = false;
    });
};

const handleStepChange = (step) => {
  currentStep.value = step;
};

const handleHandoverComplete = () => {
  currentStep.value = 6;
};

const handleLogout = async () => {
  await userStore.logout();
  router.push("/login");
};

const closeRecordView = () => {
  currentStep.value = 0;
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
    currentStep.value = -1;
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
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-layout {
  display: flex;
  flex: 1;
  height: 100vh;
  overflow: hidden;
}

.main-area {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
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
