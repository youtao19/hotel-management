<template>
  <div class="handover-process">
    <div class="handover-top-bar">
      <div class="top-bar-title">交接班</div>

      <q-input
        :model-value="selectedDate"
        dense
        outlined
        readonly
        hide-bottom-space
        class="top-date-input"
      >
        <template #prepend>
          <q-icon name="event" />
        </template>
        <template #append>
          <q-icon name="expand_more" class="cursor-pointer">
            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
              <q-date
                :model-value="selectedDate"
                mask="YYYY-MM-DD"
                @update:model-value="handleDateChange"
              />
            </q-popup-proxy>
          </q-icon>
        </template>
      </q-input>

      <div class="top-meta">
        <span class="meta-label">当前班次：</span>
        <span>{{ currentShiftLabel }}</span>
      </div>

      <div class="top-meta">
        <span class="meta-label">当前用户：</span>
        <span>{{ currentUserLabel }}</span>
      </div>

      <div class="top-meta">
        <span class="meta-label">昨日交接班：</span>
        <span :class="yesterdayStatusClass">{{ yesterdayStatusText }}</span>
      </div>

      <q-space />

      <q-btn
        flat
        no-caps
        icon="history"
        label="历史记录"
        class="history-link-btn"
        @click="emit('show-history')"
      />
    </div>

    <div class="confirmation-layout">
      <section class="confirmation-table-panel">
        <div class="confirmation-heading">
          <div>
            <div class="text-h6 text-weight-bold">
              <q-icon name="verified" color="primary" class="q-mr-sm" />
              确认交接数据
            </div>
            <div class="text-caption text-grey-7 q-mt-xs">
              表格金额由后端生成，留存款可在表内调整，保存时后端会重新校验。
            </div>
          </div>
          <q-badge
            :color="yesterdayRecord.isComplete ? 'positive' : 'orange'"
            outline
            class="status-badge"
          >
            {{ yesterdayRecord.isComplete ? "昨日记录完整" : "昨日记录缺失" }}
          </q-badge>
        </div>

        <ShiftHandoverPaymentTable
          :payment-data="paymentData"
          :read-only="false"
          @update-retained="handleRetainedAmountUpdate"
        />

        <ShiftHandoverSpecialStats
          :total-rooms="specialStats.openCount"
          :rest-rooms="specialStats.restCount"
          :vip-cards="vipCards"
          :cashier-name="currentUserName"
          :notes="handoverInfo.notes"
          :good-review="goodReviewText"
          :read-only="false"
          @update:vip-cards="value => { vipCards = Number(value) || 0 }"
          @update:notes="value => { handoverInfo.notes = value }"
        />
      </section>

      <aside class="confirmation-sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">
            <q-icon name="assignment_turned_in" color="primary" />
            <span>交接确认</span>
          </div>

          <div class="handover-total">
            <div class="total-label">应交款合计</div>
            <div class="total-value">¥{{ formatAmount(handoverTotal) }}</div>
          </div>

          <div class="confirm-fields">
            <q-input
              v-model="handoverInfo.nextOperator"
              label="接班人员"
              outlined
              dense
              :rules="[val => !!val || '请输入接班人员姓名']"
            />
            <q-input
              v-model="handoverInfo.handoverTime"
              label="交接时间"
              outlined
              dense
              type="datetime-local"
            />
            <q-input
              v-model="handoverInfo.notes"
              type="textarea"
              label="交接备注"
              outlined
              dense
              rows="3"
              placeholder="需要接班人注意的事项..."
            />
          </div>

          <div class="confirm-checklist">
            <div
              v-for="item in confirmationChecklist"
              :key="item.label"
              class="checklist-item"
              :class="{ 'checklist-item--done': item.done }"
            >
              <q-icon :name="item.done ? 'check_circle' : 'radio_button_unchecked'" />
              <span>{{ item.label }}</span>
            </div>
          </div>

          <q-btn
            color="positive"
            icon="check"
            label="完成交接"
            class="complete-button"
            unelevated
            :loading="loading || submitting"
            :disable="loading || submitting || !canComplete"
            @click="completeHandoverFlow"
          />
        </div>
      </aside>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="42px" />
    </q-inner-loading>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import { shiftHandoverApi } from "src/api";
import ShiftHandoverPaymentTable from "./ShiftHandoverPaymentTable.vue";
import ShiftHandoverSpecialStats from "./ShiftHandoverSpecialStats.vue";
import { useHandoverSubmit } from "../composables/useHandoverSubmit";

const emit = defineEmits(["complete", "show-history"]);

const $q = useQuasar();

const PAY_WAY_KEYS = ["现金", "微信", "微邮付", "其他"];

const selectedDate = ref(formatLocalDate(new Date()));
const loading = ref(false);
const canComplete = ref(true);
const paymentData = ref(createEmptyPaymentData());
const specialStats = ref({ openCount: 0, restCount: 0, invited: 0, positive: 0 });
const yesterdayRecord = ref({
  hasRecord: false,
  isComplete: false,
  statusText: "检查中",
  reserveDefaults: createEmptyBucket()
});
const currentShift = ref({ label: "早班", timeRange: "08:00-16:00" });
const currentUser = ref({ name: "当前用户", role: "前台" });
const vipCards = ref(0);

const handoverInfo = ref({
  nextOperator: "",
  handoverTime: formatDateTimeLocal(new Date()),
  notes: ""
});

const { submitting, completeHandover } = useHandoverSubmit({
  handoverInfo,
  selectedHandoverDate: selectedDate,
  retainedAmount: computed(() => paymentData.value.retainedAmount || createEmptyBucket()),
  vipCards
});

const currentShiftLabel = computed(() => `${currentShift.value.label}（${currentShift.value.timeRange}）`);
const currentUserName = computed(() => currentUser.value.name || "当前用户");
const currentUserLabel = computed(() => `${currentUserName.value}（${currentUser.value.role || "前台"}）`);
const yesterdayStatusText = computed(() => yesterdayRecord.value.statusText || (yesterdayRecord.value.isComplete ? "已完成" : "缺失"));
const yesterdayStatusClass = computed(() => ({
  "yesterday-status": true,
  "yesterday-status--done": yesterdayRecord.value.isComplete,
  "yesterday-status--missing": !yesterdayRecord.value.isComplete
}));
const goodReviewText = computed(() => `邀${specialStats.value.invited || 0}得${specialStats.value.positive || 0}`);
const handoverTotal = computed(() => sumBucket(paymentData.value.handoverAmount));
const confirmationChecklist = computed(() => [
  {
    label: yesterdayRecord.value.isComplete ? "昨日记录完整" : "昨日记录已按缺失处理",
    done: true
  },
  {
    label: loading.value ? "交接表生成中" : "交接表已生成",
    done: !loading.value
  },
  {
    label: "接班人员已填写",
    done: Boolean(handoverInfo.value.nextOperator)
  }
]);

function createEmptyBucket() {
  return PAY_WAY_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

function createEmptyPaymentData() {
  return {
    reserve: createEmptyBucket(),
    hotelIncome: createEmptyBucket(),
    restIncome: createEmptyBucket(),
    carRentIncome: createEmptyBucket(),
    totalIncome: createEmptyBucket(),
    hotelRefundDeposit: createEmptyBucket(),
    restRefundDeposit: createEmptyBucket(),
    totalRefundDeposit: createEmptyBucket(),
    retainedAmount: createEmptyBucket(),
    handoverAmount: createEmptyBucket()
  };
}

function formatLocalDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTimeLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toAmount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}

function sumBucket(bucket = {}) {
  return PAY_WAY_KEYS.reduce((sum, key) => sum + toAmount(bucket[key]), 0);
}

function normalizePaymentData(source = {}) {
  const empty = createEmptyPaymentData();
  return {
    reserve: source.reserve || empty.reserve,
    hotelIncome: source.hotelIncome || empty.hotelIncome,
    restIncome: source.restIncome || empty.restIncome,
    carRentIncome: source.carRentIncome || empty.carRentIncome,
    totalIncome: source.totalIncome || empty.totalIncome,
    hotelRefundDeposit: source.hotelRefundDeposit || source.hotelDeposit || empty.hotelRefundDeposit,
    restRefundDeposit: source.restRefundDeposit || source.restDeposit || empty.restRefundDeposit,
    totalRefundDeposit: source.totalRefundDeposit || empty.totalRefundDeposit,
    retainedAmount: source.retainedAmount || empty.retainedAmount,
    handoverAmount: source.handoverAmount || empty.handoverAmount
  };
}

function recalculateLocalPaymentData() {
  const current = normalizePaymentData(paymentData.value);
  PAY_WAY_KEYS.forEach((key) => {
    current.totalIncome[key] = toAmount(
      toAmount(current.reserve[key])
      + toAmount(current.hotelIncome[key])
      + toAmount(current.restIncome[key])
      + toAmount(current.carRentIncome[key])
    );
    current.totalRefundDeposit[key] = toAmount(
      toAmount(current.hotelRefundDeposit[key]) + toAmount(current.restRefundDeposit[key])
    );
    current.handoverAmount[key] = toAmount(
      current.totalIncome[key] - current.totalRefundDeposit[key] - toAmount(current.retainedAmount[key])
    );
  });
  paymentData.value = current;
}

function formatAmount(value) {
  return toAmount(value).toFixed(2);
}

async function loadOverview() {
  try {
    loading.value = true;
    const response = await shiftHandoverApi.getOverview({ date: selectedDate.value });
    if (!response.success) {
      throw new Error(response.message || "获取交接班数据失败");
    }

    const data = response.data || {};
    paymentData.value = normalizePaymentData(data.paymentData);
    specialStats.value = data.specialStats || specialStats.value;
    yesterdayRecord.value = data.yesterdayRecord || yesterdayRecord.value;
    currentShift.value = data.currentShift || currentShift.value;
    currentUser.value = data.currentUser || currentUser.value;
    canComplete.value = data.canComplete !== false;
    vipCards.value = Number(data.paymentData?.vipCards) || 0;
  } catch (error) {
    console.error("加载交接班数据失败:", error);
    $q.notify({
      type: "negative",
      message: error.message || "加载交接班数据失败",
      position: "top"
    });
  } finally {
    loading.value = false;
  }
}

function handleRetainedAmountUpdate({ payWay, value }) {
  paymentData.value = {
    ...paymentData.value,
    retainedAmount: {
      ...(paymentData.value.retainedAmount || createEmptyBucket()),
      [payWay]: toAmount(value)
    }
  };
  recalculateLocalPaymentData();
}

function handleDateChange(value) {
  if (!value) return;
  selectedDate.value = value;
  loadOverview();
}

async function completeHandoverFlow() {
  const success = await completeHandover();
  if (success) {
    emit("complete");
    await loadOverview();
  }
}

onMounted(loadOverview);
</script>

<style scoped>
.handover-process {
  position: relative;
  width: 100%;
  max-width: 1180px;
  height: 100%;
  overflow: hidden;
}

.handover-top-bar {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 22px;
  padding: 12px 18px;
  margin-bottom: 16px;
  background: #fff;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
}

.top-bar-title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2937;
}

.top-date-input {
  width: 168px;
}

.top-meta {
  font-size: 14px;
  color: #374151;
  white-space: nowrap;
}

.meta-label {
  color: #7b8494;
}

.yesterday-status {
  font-weight: 700;
}

.yesterday-status--done {
  color: #16a34a;
}

.yesterday-status--missing {
  color: #f97316;
}

.history-link-btn {
  color: #1d4ed8;
  font-weight: 600;
}

.confirmation-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
  height: calc(100% - 82px);
  min-height: 0;
  overflow: hidden;
}

.confirmation-table-panel,
.sidebar-card {
  background: #fff;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
}

.confirmation-table-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 18px 20px;
}

.confirmation-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.status-badge {
  padding: 7px 12px;
  font-size: 13px;
}

.confirmation-sidebar {
  min-height: 0;
  overflow: hidden;
}

.sidebar-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 18px;
}

.sidebar-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 18px;
}

.handover-total {
  padding: 14px 16px;
  margin-bottom: 16px;
  border: 1px solid #b7e4bd;
  border-radius: 6px;
  background: #f1fbf3;
}

.total-label {
  color: #5f7a64;
  font-weight: 600;
  margin-bottom: 8px;
}

.total-value {
  color: #166534;
  font-size: 28px;
  font-weight: 800;
}

.confirm-fields {
  display: grid;
  gap: 12px;
}

.confirm-checklist {
  display: grid;
  gap: 8px;
  padding: 14px 0;
  margin-top: auto;
  border-top: 1px solid #edf0f5;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8792a2;
  font-size: 14px;
}

.checklist-item--done {
  color: #1d7ad8;
  font-weight: 600;
}

.complete-button {
  height: 46px;
  font-size: 16px;
  font-weight: 700;
}

@media (max-width: 1180px) {
  .confirmation-layout {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .confirmation-sidebar {
    overflow: visible;
  }
}
</style>
