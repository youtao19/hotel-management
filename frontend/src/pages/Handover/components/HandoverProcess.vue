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
          <q-btn
            outline
            dense
            no-caps
            color="primary"
            icon="payments"
            :label="cashSettingButtonLabel"
            class="cash-reserve-button"
            :disable="loading || handoverCompleted"
            @click="cashReserveDialog = true"
          />
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
          :cash-reserve-configured="cashReserveSetting.configured"
          :read-only="false"
          @update-retained="handleRetainedAmountUpdate"
          @show-source="openSourceDetails"
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

    <q-dialog v-model="cashReserveDialog" persistent>
      <q-card class="cash-reserve-dialog">
        <q-card-section class="cash-reserve-dialog__header">
          <div class="cash-reserve-dialog__icon">
            <q-icon name="account_balance_wallet" size="24px" />
          </div>
          <div>
          <div class="text-h6">设置备用金与留存款</div>
            <div class="cash-reserve-dialog__date">营业日期：{{ selectedDate }}</div>
          </div>
        </q-card-section>

        <q-card-section class="cash-reserve-dialog__body">
          <div class="cash-reserve-dialog__hint">备用金将用于今日交接班的现金核对。</div>
          <div class="cash-reserve-dialog__fields">
            <div class="cash-reserve-dialog__field">
              <q-input
                v-model.number="cashReserveInput"
                type="number"
                min="0"
                step="0.01"
                outlined
                dense
                autofocus
                label="现金备用金（元）"
                :rules="[value => Number.isFinite(Number(value)) && Number(value) >= 0 || '请输入大于等于 0 的金额']"
              >
                <template #prepend>
                  <span class="cash-reserve-dialog__currency">¥</span>
                </template>
              </q-input>
              <div class="cash-reserve-dialog__presets">
                <span class="cash-reserve-dialog__preset-label">常用金额</span>
                <q-btn unelevated dense no-caps color="primary" label="320 元" class="cash-reserve-dialog__preset" @click="cashReserveInput = 320" />
              </div>
            </div>
            <div class="cash-reserve-dialog__field">
              <q-input
                v-model.number="cashRetainedInput"
                type="number"
                min="0"
                step="0.01"
                outlined
                dense
                label="现金留存款（元）"
                :rules="[value => Number.isFinite(Number(value)) && Number(value) >= 0 || '请输入大于等于 0 的金额']"
              >
                <template #prepend>
                  <span class="cash-reserve-dialog__currency">¥</span>
                </template>
              </q-input>
              <div class="cash-reserve-dialog__presets">
                <span class="cash-reserve-dialog__preset-label">常用金额</span>
                <q-btn unelevated dense no-caps color="primary" label="320 元" class="cash-reserve-dialog__preset" @click="cashRetainedInput = 320" />
              </div>
            </div>
          </div>
        </q-card-section>
        <q-card-actions class="cash-reserve-dialog__actions">
          <q-btn flat no-caps label="取消" :disable="savingCashReserve" v-close-popup />
          <q-btn color="primary" no-caps unelevated label="保存" :loading="savingCashReserve" @click="saveCashReserve" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <HandoverSourceDetailsDrawer
      v-model="sourceDrawer.visible"
      :date="selectedDate"
      :item="sourceDrawer.item"
      :payment-method="sourceDrawer.paymentMethod"
    />

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
import HandoverSourceDetailsDrawer from "./HandoverSourceDetailsDrawer.vue";
import { useHandoverSubmit } from "../composables/useHandoverSubmit";

const emit = defineEmits(["complete", "show-history"]);

const $q = useQuasar();

const PAY_WAY_KEYS = ["现金", "微信", "微邮付", "其他"];

const selectedDate = ref(formatLocalDate(new Date()));
const loading = ref(false);
const canComplete = ref(true);
const completeBlockReasons = ref([]);
const isCompleted = ref(false);
const paymentData = ref(createEmptyPaymentData());
const cashReserveSetting = ref({ configured: false, amount: null, cashRetained: null, setBy: null, updatedAt: null });
const cashReserveDialog = ref(false);
const cashReserveInput = ref(0);
const cashRetainedInput = ref(0);
const savingCashReserve = ref(false);
const sourceDrawer = ref({ visible: false, item: "", paymentMethod: "" });
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
const handoverCompleted = computed(() => isCompleted.value);
const cashSettingButtonLabel = computed(() => {
  if (handoverCompleted.value) return "备用金与留存款已锁定";
  return "设置备用金与留存款";
});
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
    label: cashReserveSetting.value.configured ? "今日备用金与留存款已设置" : (completeBlockReasons.value[0] || "请先设置今日备用金与留存款"),
    done: cashReserveSetting.value.configured
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
    cashReserveSetting.value = data.cashReserveSetting || cashReserveSetting.value;
    cashReserveInput.value = data.cashReserveSetting?.configured ? Number(data.cashReserveSetting.amount) : 0;
    cashRetainedInput.value = data.cashReserveSetting?.configured ? Number(data.cashReserveSetting.cashRetained) : 0;
    canComplete.value = data.canComplete !== false;
    completeBlockReasons.value = data.completeBlockReasons || [];
    isCompleted.value = data.isCompleted === true;
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

async function saveCashReserve() {
  const rawReserve = cashReserveInput.value;
  const rawRetained = cashRetainedInput.value;
  const cashReserve = Number(rawReserve);
  const cashRetained = Number(rawRetained);
  const hasInvalidAmount = [rawReserve, rawRetained].some((value) => value === "" || value === null || value === undefined)
    || !Number.isFinite(cashReserve)
    || !Number.isFinite(cashRetained)
    || cashReserve < 0
    || cashRetained < 0;

  if (hasInvalidAmount) {
    $q.notify({ type: "negative", message: "请输入大于等于 0 的备用金与留存款", position: "top" });
    return;
  }

  try {
    savingCashReserve.value = true;
    const response = await shiftHandoverApi.setDailyCashReserve({
      date: selectedDate.value,
      cashReserve: Number(cashReserve.toFixed(2)),
      cashRetained: Number(cashRetained.toFixed(2))
    });
    if (!response.success) {
      throw new Error(response.message || "保存备用金与留存款失败");
    }
    cashReserveDialog.value = false;
    await loadOverview();
    $q.notify({ type: "positive", message: "备用金与留存款已保存", position: "top" });
  } catch (error) {
    $q.notify({
      type: "negative",
      message: error.response?.data?.message || error.message || "保存备用金与留存款失败",
      position: "top"
    });
  } finally {
    savingCashReserve.value = false;
  }
}

// 预设值仅用于减少重复输入，仍由后端校验金额和当日交接状态。
function applyCashReservePreset(amount) {
  cashReserveInput.value = amount;
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

/**
 * 当前交接表来源按正在查看的营业日期查询，金额归属仍由后端统一校验。
 */
function openSourceDetails({ item, paymentMethod }) {
  sourceDrawer.value = { visible: true, item, paymentMethod };
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
  max-width: 1260px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.handover-top-bar {
  display: flex;
  min-height: 102px;
  align-items: center;
  gap: 22px;
  padding: 18px 22px;
  margin-bottom: 20px;
  flex-shrink: 0;
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

.cash-reserve-dialog {
  width: 560px;
  max-width: calc(100vw - 32px);
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 18px 45px rgba(24, 57, 93, 0.18);
}

.cash-reserve-dialog__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px 14px;
  background: linear-gradient(135deg, #f2f8ff 0%, #fff 72%);
}

.cash-reserve-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: #1976d2;
  background: #e4f1ff;
  border-radius: 12px;
}

.cash-reserve-dialog__date {
  margin-top: 4px;
  color: #738196;
  font-size: 13px;
}

.cash-reserve-dialog__body {
  display: grid;
  gap: 12px;
  padding: 16px 20px 18px;
}

.cash-reserve-dialog__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.cash-reserve-dialog__field {
  padding: 12px;
  background: #f8fbff;
  border: 1px solid #e2eaf4;
  border-radius: 10px;
}

.cash-reserve-dialog__hint {
  padding: 8px 10px;
  color: #5f6f82;
  font-size: 13px;
  line-height: 20px;
  background: #f7faff;
  border-radius: 8px;
}

.cash-reserve-dialog__currency {
  color: #1976d2;
  font-size: 18px;
  font-weight: 700;
}

.cash-reserve-dialog__presets {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
}

.cash-reserve-dialog__preset-label {
  color: #738196;
  font-size: 13px;
}

.cash-reserve-dialog__preset {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font-weight: 600;
}

.cash-reserve-dialog__actions {
  gap: 8px;
  justify-content: flex-end;
  padding: 10px 20px 14px;
  border-top: 1px solid #edf1f6;
}

.cash-reserve-dialog__actions .q-btn {
  min-width: 80px;
  min-height: 38px;
  border-radius: 8px;
}

.confirmation-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 374px;
  gap: 20px;
  flex: 1;
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
  padding: 24px;
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

.cash-reserve-button {
  align-self: flex-start;
  min-height: 34px;
  padding: 0 12px;
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
  padding: 24px;
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
